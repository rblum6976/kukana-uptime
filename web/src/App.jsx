import { useEffect, useState } from "react";

function Sparkline({ points }) {
    const width = 120;
    const height = 30;

    if (!points || points.length < 2) {
        return <div>—</div>;
    }

    const maxLatency = Math.max(...points.map((p) => p.latency || 0), 1);

    const path = points
        .map((p, i) => {
            const x = (i / (points.length - 1)) * width;
            const y = height - ((p.latency || 0) / maxLatency) * height;

            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

    return (
        <svg width={width} height={height}>
            <path d={path} stroke="#22c55e" fill="none" strokeWidth={2} />
        </svg>
    );
}

function StatusCard({ item, history }) {
    const bg = item.up ? "#052e16" : "#3f0d0d";
    const color = item.up ? "#22c55e" : "#ef4444";
    const points = history[`${item.group}::${item.name}`] || [];

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
            <div style={{ fontWeight: "bold" }}>{item.name}</div>
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

    cfg.groups.forEach((g, gi) => {
        if (!g.name) {
            errs[`group-${gi}-name`] = "Group name required";
            valid = false;
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

    if (loadError && !config) {
        return <div>{loadError}</div>;
    }

    const historyMap = {};
    history.forEach((h) => {
        historyMap[`${h.group}::${h.name}`] = h.points;
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

    function updateGroupName(i, val) {
        const c = { ...config };
        c.groups[i].name = val;
        updateConfig(c);
    }

    function addGroup() {
        updateConfig({
            ...config,
            groups: [...config.groups, { name: "", targets: [] }],
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
            fetchStatus();
        } catch {
            setMessage("❌ Save failed");
        }
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
                <h1 style={{ margin: 0 }}>Kukana - Uptime Dashboard</h1>
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
                        Update groups and targets, then save to apply changes.
                    </div>
                    {config.groups.map((g, gi) => (
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
                            <div style={{ marginBottom: "8px", fontSize: "13px", color: "#94a3b8" }}>
                                Group
                            </div>
                            <input
                                value={g.name}
                                placeholder="Group name"
                                style={fieldStyle(`group-${gi}-name`)}
                                onChange={(e) => updateGroupName(gi, e.target.value)}
                            />
                            {errorText(`group-${gi}-name`)}

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
                                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>Target</div>
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
                                <button style={dangerButtonStyle} onClick={() => removeGroup(gi)}>
                                    Delete Group
                                </button>
                            </div>
                        </div>
                    ))}

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
                        <span style={{ color: "#cbd5e1" }}>{message}</span>
                    </div>
                </div>
            )}
        </div>
    );
}