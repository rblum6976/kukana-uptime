import { useEffect, useState } from "react";

const APP_TITLE_FALLBACK = "Kukana - Uptime Dashboard";

function Sparkline({ points }) {
    const width = 120;
    const height = 30;
    const [hoverPoint, setHoverPoint] = useState(null);

    if (!points || points.length < 2) {
        return <div style={{ height: "30px", display: "flex", alignItems: "center" }}>—</div>;
    }

    const maxLatency = Math.max(...points.map((p) => p.latency || 0), 1);

    const segments = [];
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const x1 = (i / (points.length - 1)) * width;
        const y1 = height - ((p1.latency || 0) / maxLatency) * height;
        const x2 = ((i + 1) / (points.length - 1)) * width;
        const y2 = height - ((p2.latency || 0) / maxLatency) * height;

        segments.push({
            x1, y1, x2, y2,
            color: p2.up ? "#22c55e" : "#ef4444",
            point: p2
        });
    }

    return (
        <div style={{ position: "relative" }}>
            <svg
                width={width}
                height={height}
                onMouseLeave={() => setHoverPoint(null)}
                style={{ overflow: "visible" }}
            >
                {segments.map((s, i) => (
                    <line
                        key={i}
                        x1={s.x1}
                        y1={s.y1}
                        x2={s.x2}
                        y2={s.y2}
                        stroke={s.color}
                        strokeWidth={2}
                        onMouseEnter={() => setHoverPoint(s.point)}
                    />
                ))}
                {segments.map((s, i) => (
                    <circle
                        key={`c-${i}`}
                        cx={s.x2}
                        cy={s.y2}
                        r={3}
                        fill="transparent"
                        onMouseEnter={() => setHoverPoint(s.point)}
                    />
                ))}
            </svg>
            {hoverPoint && (
                <div
                    style={{
                        position: "absolute",
                        top: "-40px",
                        left: "0",
                        background: "#1e293b",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        whiteSpace: "nowrap",
                        zIndex: 10,
                        border: "1px solid #334155",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.3)"
                    }}
                >
                    {new Date(hoverPoint.time).toLocaleTimeString()} - {hoverPoint.latency ?? "N/A"}ms
                </div>
            )}
        </div>
    );
}

function StatusCard({ item, history }) {
    const bg = item.up ? "#052e16" : "#3f0d0d";
    const color = item.up ? "#22c55e" : "#ef4444";
    const historyItem = history[`${item.group}::${item.name}`];
    const points = historyItem?.points || [];
    const uptime = historyItem?.uptime ?? 100;

    return (
        <div
            style={{
                background: bg,
                borderRadius: "12px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ fontWeight: "bold" }}>{item.name}</div>
                <div style={{ fontSize: "10px", background: "#1e293b", padding: "2px 6px", borderRadius: "10px" }}>
                    {uptime}% uptime
                </div>
            </div>
            <div style={{ color }}>{item.up ? "● UP" : "● DOWN"}</div>
            <div style={{ fontSize: "12px" }}>Latency: {item.latency ?? "N/A"} ms</div>
            <Sparkline points={points} />
            <div style={{ fontSize: "10px", opacity: 0.6 }}>
                {new Date(item.lastChecked).toLocaleTimeString()}
            </div>
        </div>
    );
}

function validateConfig(cfg) {
    const errs = {};
    let valid = true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9\s().-]{7,}$/;

    cfg.groups.forEach((g, gi) => {
        if (!g.name) {
            errs[`group-${gi}-name`] = "Group name required";
            valid = false;
        }

        if (g.alerts) {
            if (!g.alerts.channel) {
                errs[`group-${gi}-alerts-channel`] = "Alert channel required";
                valid = false;
            }

            if (!g.alerts.destination) {
                errs[`group-${gi}-alerts-destination`] = "Alert destination required";
                valid = false;
            } else if (g.alerts.channel === "email" && !emailRegex.test(g.alerts.destination)) {
                errs[`group-${gi}-alerts-destination`] = "Invalid email";
                valid = false;
            } else if (g.alerts.channel === "sms" && !phoneRegex.test(g.alerts.destination)) {
                errs[`group-${gi}-alerts-destination`] = "Invalid phone number";
                valid = false;
            }
        }

        if (!g.targets || g.targets.length === 0) {
            errs[`group-${gi}-targets`] = "At least one target required";
            valid = false;
        }

        g.targets.forEach((t, ti) => {
            if (!t.name) {
                errs[`g-${gi}-t-${ti}-name`] = "Name required";
                valid = false;
            }

            if (t.type === "http") {
                if (!t.url) {
                    errs[`g-${gi}-t-${ti}-url`] = "URL required";
                    valid = false;
                } else {
                    try {
                        new URL(t.url);
                    } catch {
                        errs[`g-${gi}-t-${ti}-url`] = "Invalid URL";
                        valid = false;
                    }
                }
            }

            if (t.type === "tcp") {
                if (!t.host) {
                    errs[`g-${gi}-t-${ti}-host`] = "Host required";
                    valid = false;
                }

                if (!t.port || t.port < 1 || t.port > 65535) {
                    errs[`g-${gi}-t-${ti}-port`] = "Port 1–65535";
                    valid = false;
                }
            }
        });
    });

    return { errs, valid };
}

export function App() {
    const [data, setData] = useState([]);
    const [config, setConfig] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [mode, setMode] = useState("dashboard");
    const [message, setMessage] = useState("");
    const [errors, setErrors] = useState({});
    const [history, setHistory] = useState([]);
    const [collapsed, setCollapsed] = useState({});

    async function fetchStatus() {
        const res = await fetch("/api/status");
        if (!res.ok) {
            throw new Error("Failed to load status");
        }
        setData(await res.json());
    }

    async function fetchConfig() {
        const res = await fetch("/api/config");
        if (!res.ok) {
            throw new Error("Failed to load config");
        }
        setConfig(await res.json());
    }

    async function fetchHistory() {
        const res = await fetch("/api/history");
        if (!res.ok) {
            throw new Error("Failed to load history");
        }
        setHistory(await res.json());
    }

    useEffect(() => {
        async function loadInitial() {
            try {
                await Promise.all([fetchStatus(), fetchConfig(), fetchHistory()]);
                setLoadError("");
            } catch {
                setLoadError("Failed to load initial data. Ensure backend is running on port 3000.");
            }
        }

        loadInitial();

        const interval = setInterval(() => {
            Promise.all([fetchStatus(), fetchHistory()]).catch(() => {
                // keep current UI data on polling errors
            });
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const appTitle = config?.appTitle?.trim() || APP_TITLE_FALLBACK;
        document.title = appTitle;
    }, [config?.appTitle]);

    if (loadError && !config) {
        return <div>{loadError}</div>;
    }

    const historyMap = {};
    history.forEach((h) => {
        historyMap[`${h.group}::${h.name}`] = h;
    });

    function validate(cfg) {
        const { errs, valid } = validateConfig(cfg);
        setErrors(errs);
        return valid;
    }

    function updateConfig(newConfig) {
        setConfig(newConfig);
        validate(newConfig);
    }

    function updateAppTitle(val) {
        const c = { ...config };
        c.appTitle = val;
        updateConfig(c);
    }

    function updateGroupName(i, val) {
        const c = { ...config };
        c.groups[i].name = val;
        updateConfig(c);
    }

    function addGroup() {
        updateConfig({
            ...config,
            groups: [
                ...config.groups,
                {
                    name: "",
                    alerts: {
                        channel: "email",
                        destination: "",
                    },
                    targets: [],
                },
            ],
        });
    }

    function removeGroup(i) {
        const c = { ...config };
        c.groups.splice(i, 1);
        updateConfig(c);
    }

    function addTarget(gi) {
        const c = { ...config };
        c.groups[gi].targets.push({
            name: "",
            type: "http",
            url: "",
            alerts: {
                enabled: true,
            },
        });
        updateConfig(c);
    }

    function removeTarget(gi, ti) {
        const c = { ...config };
        c.groups[gi].targets.splice(ti, 1);
        updateConfig(c);
    }

    function updateTarget(gi, ti, field, value) {
        const c = { ...config };
        c.groups[gi].targets[ti][field] = value;
        updateConfig(c);
    }

    function updateGroupAlerts(gi, field, value) {
        const c = { ...config };
        c.groups[gi].alerts = c.groups[gi].alerts || { channel: "email", destination: "" };
        c.groups[gi].alerts[field] = value;
        updateConfig(c);
    }

    function updateTargetAlerts(gi, ti, enabled) {
        const c = { ...config };
        c.groups[gi].targets[ti].alerts = c.groups[gi].targets[ti].alerts || { enabled: true };
        c.groups[gi].targets[ti].alerts.enabled = enabled;
        updateConfig(c);
    }

    function moveTarget(gi, ti, direction) {
        const c = { ...config };
        const targets = c.groups[gi].targets;
        const newIndex = ti + direction;

        if (newIndex < 0 || newIndex >= targets.length) return;

        const [moved] = targets.splice(ti, 1);
        targets.splice(newIndex, 0, moved);
        updateConfig(c);
    }

    function moveGroup(gi, direction) {
        const c = { ...config };
        const groups = c.groups;
        const newIndex = gi + direction;

        if (newIndex < 0 || newIndex >= groups.length) return;

        const [moved] = groups.splice(gi, 1);
        groups.splice(newIndex, 0, moved);
        updateConfig(c);
    }

    async function saveConfig() {
        if (!validate(config)) {
            setMessage("❌ Fix errors before saving");
            return;
        }

        try {
            const res = await fetch("/api/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });

            if (!res.ok) throw new Error();

            setMessage("✅ Saved");
            setTimeout(() => setMessage(""), 3000);
            fetchStatus();
        } catch {
            setMessage("❌ Save failed");
        }
    }

    function toggleCollapse(gi) {
        setCollapsed(prev => ({
            ...prev,
            [gi]: !prev[gi]
        }));
    }

    if (!config) {
        return <div>Loading...</div>;
    }

    const grouped = data.reduce((acc, item) => {
        acc[item.group] = acc[item.group] || [];
        acc[item.group].push(item);
        return acc;
    }, {});

    const errorStyle = {
        border: "1px solid #ef4444",
        background: "#3f0d0d",
    };

    const inputBaseStyle = {
        background: "#0f172a",
        color: "#e5e7eb",
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "8px 10px",
        minHeight: "36px",
    };

    const baseButtonStyle = {
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "14px",
        fontWeight: 600,
        cursor: "pointer",
    };

    const modeButtonStyle = {
        ...baseButtonStyle,
        background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
        color: "#f8fafc",
        border: "1px solid #1d4ed8",
        boxShadow: "0 8px 24px rgba(37, 99, 235, 0.35)",
    };

    const actionButtonStyle = {
        ...baseButtonStyle,
        background: "#1e293b",
        color: "#e5e7eb",
    };

    const dangerButtonStyle = {
        ...baseButtonStyle,
        background: "#3f0d0d",
        color: "#fecaca",
        border: "1px solid #991b1b",
    };

    function fieldStyle(key) {
        return errors[key] ? { ...inputBaseStyle, ...errorStyle } : inputBaseStyle;
    }

    function errorText(key) {
        return errors[key] ? <div style={{ color: "#ef4444", fontSize: "12px" }}>{errors[key]}</div> : null;
    }

    return (
        <div
            style={{
                fontFamily: "system-ui",
                background: "#020617",
                color: "#e5e7eb",
                minHeight: "100vh",
                padding: "20px",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "18px",
                    flexWrap: "wrap",
                }}
            >
                <h1 style={{ margin: 0 }}>{config.appTitle || APP_TITLE_FALLBACK}</h1>
                <button
                    style={modeButtonStyle}
                    onClick={() => setMode(mode === "dashboard" ? "config" : "dashboard")}
                >
                    {mode === "dashboard" ? "Edit Config" : "Back"}
                </button>
            </div>

            {mode === "dashboard" &&
                Object.entries(grouped).map(([groupName, items]) => (
                    <div key={groupName} style={{ marginBottom: "24px" }}>
                        <h2 style={{ marginBottom: "10px" }}>{groupName}</h2>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                                gap: "14px",
                            }}
                        >
                            {items.map((item) => (
                                <StatusCard
                                    key={`${item.group}-${item.name}`}
                                    item={item}
                                    history={historyMap}
                                />
                            ))}
                        </div>
                    </div>
                ))}

            {mode === "config" && (
                <div
                    style={{
                        background: "#0b1224",
                        border: "1px solid #1e293b",
                        borderRadius: "14px",
                        padding: "16px",
                    }}
                >
                    <div style={{ marginBottom: "16px", color: "#94a3b8", fontSize: "14px" }}>
                        Update app title, groups, and targets, then save to apply changes.
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                        <div style={{ marginBottom: "8px", fontSize: "13px", color: "#94a3b8" }}>App Title</div>
                        <input
                            value={config.appTitle || ""}
                            placeholder={APP_TITLE_FALLBACK}
                            style={{ ...inputBaseStyle, width: "100%", maxWidth: "520px" }}
                            onChange={(e) => updateAppTitle(e.target.value)}
                        />
                    </div>
                    {config.groups.map((g, gi) => {
                        const isCollapsed = collapsed[gi] ?? true;
                        return (
                            <div
                                key={gi}
                                style={{
                                    marginBottom: "18px",
                                    padding: "14px",
                                    borderRadius: "12px",
                                    border: "1px solid #334155",
                                    background: "#111827",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        cursor: "pointer",
                                        userSelect: "none"
                                    }}
                                    onClick={() => toggleCollapse(gi)}
                                >
                                    <div style={{ fontSize: "16px", fontWeight: "bold", color: "#e5e7eb" }}>
                                        {isCollapsed ? "▶" : "▼"} {g.name || "Unnamed Group"}
                                    </div>
                                    <div style={{ display: "flex", gap: "10px" }}>
                                        <div style={{ display: "flex", gap: "6px" }}>
                                            <button
                                                style={{ ...actionButtonStyle, padding: "2px 8px" }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    moveGroup(gi, -1);
                                                }}
                                                disabled={gi === 0}
                                            >
                                                ↑
                                            </button>
                                            <button
                                                style={{ ...actionButtonStyle, padding: "2px 8px" }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    moveGroup(gi, 1);
                                                }}
                                                disabled={gi === config.groups.length - 1}
                                            >
                                                ↓
                                            </button>
                                        </div>
                                        <button
                                            style={dangerButtonStyle}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeGroup(gi);
                                            }}
                                        >
                                            Delete Group
                                        </button>
                                    </div>
                                </div>

                                {!isCollapsed && (
                                    <div style={{ marginTop: "14px" }}>
                                        <div style={{ marginBottom: "8px", fontSize: "13px", color: "#94a3b8" }}>
                                            Group Name
                                        </div>
                                        <input
                                            value={g.name}
                                            placeholder="Group name"
                                            style={fieldStyle(`group-${gi}-name`)}
                                            onChange={(e) => updateGroupName(gi, e.target.value)}
                                        />
                                        {errorText(`group-${gi}-name`)}

                            <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                <select
                                    value={g.alerts?.channel || "email"}
                                    style={fieldStyle(`group-${gi}-alerts-channel`)}
                                    onChange={(e) => updateGroupAlerts(gi, "channel", e.target.value)}
                                >
                                    <option value="email">Email Alerts</option>
                                    <option value="sms">SMS Alerts</option>
                                </select>
                                <input
                                    value={g.alerts?.destination || ""}
                                    placeholder={g.alerts?.channel === "sms" ? "Phone number" : "Email address"}
                                    style={{ ...fieldStyle(`group-${gi}-alerts-destination`), minWidth: "260px" }}
                                    onChange={(e) => updateGroupAlerts(gi, "destination", e.target.value)}
                                />
                            </div>
                            {errorText(`group-${gi}-alerts-channel`)}
                            {errorText(`group-${gi}-alerts-destination`)}

                            {g.targets.map((t, ti) => (
                                            <div
                                                key={ti}
                                                style={{
                                                    marginTop: "12px",
                                                    padding: "12px",
                                                    borderRadius: "10px",
                                                    border: "1px solid #334155",
                                                    background: "#0f172a",
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "8px",
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>Target</div>
                                                    <div style={{ display: "flex", gap: "6px" }}>
                                                        <button
                                                            style={{ ...actionButtonStyle, padding: "2px 8px" }}
                                                            onClick={() => moveTarget(gi, ti, -1)}
                                                            disabled={ti === 0}
                                                        >
                                                            ↑
                                                        </button>
                                                        <button
                                                            style={{ ...actionButtonStyle, padding: "2px 8px" }}
                                                            onClick={() => moveTarget(gi, ti, 1)}
                                                            disabled={ti === g.targets.length - 1}
                                                        >
                                                            ↓
                                                        </button>
                                                    </div>
                                                </div>
                                                <input
                                                    placeholder="Name"
                                                    value={t.name}
                                                    style={fieldStyle(`g-${gi}-t-${ti}-name`)}
                                                    onChange={(e) => updateTarget(gi, ti, "name", e.target.value)}
                                                />
                                                {errorText(`g-${gi}-t-${ti}-name`)}

                                                <select
                                                    value={t.type}
                                                    style={inputBaseStyle}
                                                    onChange={(e) => updateTarget(gi, ti, "type", e.target.value)}
                                                >
                                                    <option value="http">HTTP</option>
                                                    <option value="tcp">TCP</option>
                                                </select>

                                                <label
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "8px",
                                                        fontSize: "12px",
                                                        color: "#cbd5e1",
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={t.alerts?.enabled !== false}
                                                        onChange={(e) => updateTargetAlerts(gi, ti, e.target.checked)}
                                                    />
                                                    Alerts enabled for this target
                                                </label>

                                                {t.type === "http" && (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                        <input
                                                            placeholder="URL"
                                                            value={t.url || ""}
                                                            style={fieldStyle(`g-${gi}-t-${ti}-url`)}
                                                            onChange={(e) => updateTarget(gi, ti, "url", e.target.value)}
                                                        />
                                                        {errorText(`g-${gi}-t-${ti}-url`)}
                                                    </div>
                                                )}

                                                {t.type === "tcp" && (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                        <input
                                                            placeholder="Host"
                                                            value={t.host || ""}
                                                            style={fieldStyle(`g-${gi}-t-${ti}-host`)}
                                                            onChange={(e) => updateTarget(gi, ti, "host", e.target.value)}
                                                        />
                                                        {errorText(`g-${gi}-t-${ti}-host`)}

                                                        <input
                                                            placeholder="Port"
                                                            type="number"
                                                            value={t.port || ""}
                                                            style={fieldStyle(`g-${gi}-t-${ti}-port`)}
                                                            onChange={(e) =>
                                                                updateTarget(gi, ti, "port", Number(e.target.value))
                                                            }
                                                        />
                                                        {errorText(`g-${gi}-t-${ti}-port`)}
                                                    </div>
                                                )}

                                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                                    <button style={dangerButtonStyle} onClick={() => removeTarget(gi, ti)}>
                                                        Delete Target
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                            <button style={actionButtonStyle} onClick={() => addTarget(gi)}>
                                                Add Target
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <button style={actionButtonStyle} onClick={addGroup}>
                        Add Group
                    </button>

                    <div
                        style={{
                            marginTop: "20px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            flexWrap: "wrap",
                        }}
                    >
                        <button
                            style={{
                                ...modeButtonStyle,
                                opacity: Object.keys(errors).length > 0 ? 0.6 : 1,
                                cursor: Object.keys(errors).length > 0 ? "not-allowed" : "pointer",
                            }}
                            onClick={saveConfig}
                            disabled={Object.keys(errors).length > 0}
                        >
                            Save Config
                        </button>
                        <button
                            style={actionButtonStyle}
                            onClick={() => setMode("dashboard")}
                        >
                            Back
                        </button>
                        <span style={{ color: "#cbd5e1" }}>{message}</span>
                    </div>
                </div>
            )}
        </div>
    );
}