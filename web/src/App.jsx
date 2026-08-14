import { useEffect, useRef, useState } from "react";
import { ConfigEditor } from "./components/ConfigEditor";
import { ConfigSetIndex } from "./components/ConfigSetIndex";
import { Dashboard } from "./components/Dashboard";
import { actionButtonStyle, modeButtonStyle } from "./components/styles";

const APP_TITLE_FALLBACK = "Kukana - Uptime Dashboard";
const APP_VERSION = typeof __APP_VERSION__ !== "undefined"
    ? __APP_VERSION__
    : (import.meta.env?.VITE_APP_VERSION || "1.2.0");
const VERSION_STRING = APP_VERSION.startsWith("v") ? APP_VERSION : `v${APP_VERSION}`;

function readSetIdFromPath() {
    const match = window.location.pathname.match(/^\/sets\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
}

function validateConfig(config) {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9\s().-]{7,}$/;

    config.groups.forEach((group, groupIndex) => {
        if (!group.name) errors[`group-${groupIndex}-name`] = "Group name required";

        if (group.alerts) {
            if (!group.alerts.channel) errors[`group-${groupIndex}-alerts-channel`] = "Alert channel required";
            if (group.alerts.channel === "email" || group.alerts.channel === "email_sms") {
                if (!group.alerts.emailDestination) {
                    errors[`group-${groupIndex}-alerts-email`] = "Email address required";
                } else if (!emailRegex.test(group.alerts.emailDestination)) {
                    errors[`group-${groupIndex}-alerts-email`] = "Invalid email";
                }
            }
            if (group.alerts.channel === "sms" || group.alerts.channel === "email_sms") {
                if (!group.alerts.smsDestination) {
                    errors[`group-${groupIndex}-alerts-sms`] = "Phone number required";
                } else if (!phoneRegex.test(group.alerts.smsDestination)) {
                    errors[`group-${groupIndex}-alerts-sms`] = "Invalid phone number";
                }
            }
        }

        if (!group.targets?.length) errors[`group-${groupIndex}-targets`] = "At least one target required";

        group.targets?.forEach((target, targetIndex) => {
            const fieldKey = (field) => `g-${groupIndex}-t-${targetIndex}-${field}`;
            if (!target.name) errors[fieldKey("name")] = "Name required";

            if (target.type === "http") {
                if (!target.url) {
                    errors[fieldKey("url")] = "URL required";
                } else {
                    try {
                        new URL(target.url);
                    } catch {
                        errors[fieldKey("url")] = "Invalid URL";
                    }
                }
            }

            if ((target.type === "tcp" || target.type === "ping") && !target.host) {
                errors[fieldKey("host")] = "Host required";
            }
            if (target.type === "tcp" && (!target.port || target.port < 1 || target.port > 65535)) {
                errors[fieldKey("port")] = "Port 1–65535";
            }
        });
    });

    return errors;
}

export function App() {
    const [configSets, setConfigSets] = useState([]);
    const [activeSetId, setActiveSetId] = useState(() => readSetIdFromPath());
    const [status, setStatus] = useState([]);
    const [config, setConfig] = useState(null);
    const [history, setHistory] = useState([]);
    const [errors, setErrors] = useState({});
    const [mode, setMode] = useState("dashboard");
    const [loadError, setLoadError] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const [historyMessage, setHistoryMessage] = useState("");
    const [clearingHistoryGroup, setClearingHistoryGroup] = useState(null);
    const historyRequestVersion = useRef(0);

    const isIndexPage = !activeSetId;

    function navigateToSet(setId) {
        const path = setId ? `/sets/${encodeURIComponent(setId)}` : "/";
        window.history.pushState({}, "", path);
        if (setId && setId !== activeSetId) setConfig(null);
        setActiveSetId(readSetIdFromPath());
        setMode("dashboard");
    }

    async function fetchConfigSets() {
        const response = await fetch("/api/config-sets");
        if (!response.ok) throw new Error("Failed to load configuration sets");
        setConfigSets(await response.json());
    }

    async function fetchStatus() {
        if (!activeSetId) return;
        const response = await fetch(`/api/config-sets/${encodeURIComponent(activeSetId)}/status`);
        if (!response.ok) throw new Error("Failed to load status");
        setStatus(await response.json());
    }

    async function fetchConfig() {
        if (!activeSetId) return;
        const response = await fetch(`/api/config-sets/${encodeURIComponent(activeSetId)}/config`);
        if (!response.ok) throw new Error("Failed to load config");
        const nextConfig = await response.json();
        setConfig(nextConfig);
        setErrors(validateConfig(nextConfig));
    }

    async function fetchHistory() {
        if (!activeSetId) return;
        const requestVersion = historyRequestVersion.current;
        const response = await fetch(`/api/config-sets/${encodeURIComponent(activeSetId)}/history`);
        if (!response.ok) throw new Error("Failed to load history");
        const nextHistory = await response.json();
        if (requestVersion === historyRequestVersion.current) {
            setHistory(nextHistory);
        }
    }

    useEffect(() => {
        const onPopState = () => {
            setActiveSetId(readSetIdFromPath());
            setMode("dashboard");
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    useEffect(() => {
        historyRequestVersion.current += 1;

        async function loadInitialData() {
            try {
                await fetchConfigSets();
                if (activeSetId) await Promise.all([fetchStatus(), fetchConfig(), fetchHistory()]);
                setLoadError("");
            } catch {
                setLoadError("Failed to load initial data. Ensure backend is running on port 3000.");
            }
        }

        loadInitialData();
        const interval = setInterval(() => {
            if (activeSetId) Promise.all([fetchStatus(), fetchHistory()]).catch(() => {});
        }, 5000);
        return () => clearInterval(interval);
    }, [activeSetId]);

    useEffect(() => {
        document.title = config?.appTitle?.trim() || APP_TITLE_FALLBACK;
    }, [config?.appTitle]);

    function updateConfig(nextConfig) {
        setConfig(nextConfig);
        setErrors(validateConfig(nextConfig));
    }

    async function saveConfig() {
        if (!activeSetId || !config) return;
        const validationErrors = validateConfig(config);
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length) {
            setSaveMessage("❌ Fix errors before saving");
            return;
        }

        try {
            const response = await fetch(`/api/config-sets/${encodeURIComponent(activeSetId)}/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (!response.ok) throw new Error();
            setSaveMessage("✅ Saved");
            setTimeout(() => setSaveMessage(""), 3000);
            await fetchStatus();
        } catch {
            setSaveMessage("❌ Save failed");
        }
    }

    async function clearGroupHistory(groupName) {
        if (!activeSetId || !window.confirm(`Clear all history for "${groupName}"? This cannot be undone.`)) return;
        setClearingHistoryGroup(groupName);
        setHistoryMessage("");
        try {
            const query = new URLSearchParams({ group: groupName });
            const response = await fetch(
                `/api/config-sets/${encodeURIComponent(activeSetId)}/history?${query}`,
                { method: "DELETE" },
            );
            if (!response.ok) throw new Error();
            historyRequestVersion.current += 1;
            setHistory((current) => current.filter((item) => item.group !== groupName));
            setHistoryMessage(`✅ History cleared for ${groupName}`);
        } catch {
            setHistoryMessage(`❌ Failed to clear history for ${groupName}`);
        } finally {
            setClearingHistoryGroup(null);
        }
    }

    if (loadError && !config) return <div>{loadError}</div>;
    if (!isIndexPage && !config) return <div>Loading...</div>;

    const groupedStatus = status.reduce((groups, item) => {
        groups[item.group] = groups[item.group] || [];
        groups[item.group].push(item);
        return groups;
    }, {});
    const historyByTarget = Object.fromEntries(history.map((item) => [`${item.group}::${item.name}`, item]));

    return (
        <div style={{ fontFamily: "system-ui", background: "#020617", color: "#e5e7eb", minHeight: "100vh", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <h1 style={{ margin: 0 }}>{isIndexPage ? APP_TITLE_FALLBACK : config.appTitle || APP_TITLE_FALLBACK}</h1>
                    <span
                        style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#94a3b8",
                            background: "#0f172a",
                            border: "1px solid #334155",
                            borderRadius: "6px",
                            padding: "2px 8px",
                            letterSpacing: "0.02em",
                        }}
                    >
                        {VERSION_STRING}
                    </span>
                </div>
                {!isIndexPage && (
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button style={actionButtonStyle} onClick={() => navigateToSet(null)}>All Sets</button>
                        <button style={modeButtonStyle} onClick={() => setMode(mode === "dashboard" ? "config" : "dashboard")}>
                            {mode === "dashboard" ? "Edit Config" : "Back"}
                        </button>
                    </div>
                )}
            </div>

            {isIndexPage && <ConfigSetIndex sets={configSets} onNavigate={navigateToSet} onRefresh={fetchConfigSets} />}
            {!isIndexPage && mode === "dashboard" && (
                <Dashboard
                    grouped={groupedStatus}
                    history={historyByTarget}
                    message={historyMessage}
                    clearingGroup={clearingHistoryGroup}
                    onClearHistory={clearGroupHistory}
                />
            )}
            {!isIndexPage && mode === "config" && (
                <ConfigEditor
                    config={config}
                    errors={errors}
                    message={saveMessage}
                    onChange={updateConfig}
                    onSave={saveConfig}
                    onBack={() => setMode("dashboard")}
                />
            )}
        </div>
    );
}
