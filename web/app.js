const { useEffect, useState } = React;

function StatusCard({ item, history }) {
    const bg = item.up ? "#052e16" : "#3f0d0d";
    const color = item.up ? "#22c55e" : "#ef4444";

    const points = history[`${item.group}::${item.name}`] || [];

    return React.createElement(
        "div",
        {
            style: {
                background: bg,
                borderRadius: "12px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
            },
        },

        React.createElement(
            "div",
            { style: { fontWeight: "bold" } },
            item.name
        ),

        React.createElement(
            "div",
            { style: { color } },
            item.up ? "● UP" : "● DOWN"
        ),

        React.createElement(
            "div",
            { style: { fontSize: "12px" } },
            `Latency: ${item.latency ?? "N/A"} ms`
        ),

        React.createElement(Sparkline, { points }),

        React.createElement(
            "div",
            { style: { fontSize: "10px", opacity: 0.6 } },
            new Date(item.lastChecked).toLocaleTimeString()
        )
    );
}

function Sparkline({ points }) {
    const width = 120;
    const height = 30;

    if (!points || points.length < 2) {
        return React.createElement("div", null, "—");
    }

    const maxLatency = Math.max(
        ...points.map((p) => p.latency || 0),
        1
    );

    const path = points
        .map((p, i) => {
            const x = (i / (points.length - 1)) * width;
            const y =
                height -
                ((p.latency || 0) / maxLatency) * height;

            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

    return React.createElement(
        "svg",
        { width, height },
        React.createElement("path", {
            d: path,
            stroke: "#22c55e",
            fill: "none",
            strokeWidth: 2,
        })
    );
}


function App() {
    const [data, setData] = useState([]);
    const [config, setConfig] = useState(null);
    const [mode, setMode] = useState("dashboard");
    const [message, setMessage] = useState("");
    const [errors, setErrors] = useState({});
    const [history, setHistory] = useState([]);

    async function fetchStatus() {
        const res = await fetch("/api/status");
        setData(await res.json());
    }

    async function fetchConfig() {
        const res = await fetch("/api/config");
        setConfig(await res.json());
    }

    async function fetchHistory() {
        const res = await fetch("/api/history");
        setHistory(await res.json());
    }

    useEffect(() => {
        fetchStatus();
        fetchConfig();
        fetchHistory();

        const interval = setInterval(() => {
            fetchStatus();
            fetchHistory();
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    // ------------- HISTORY LOOKUP --------------------
    const historyMap = {};
    history.forEach((h) => {
        historyMap[`${h.group}::${h.name}`] = h.points;
    });

    // ---------- VALIDATION ----------

    function validate(cfg) {
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

        setErrors(errs);
        return valid;
    }

    function isValid() {
        return validate(config);
    }

    // ---------- HELPERS ----------

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

    if (!config) return React.createElement("div", null, "Loading...");

    const grouped = data.reduce((acc, item) => {
        acc[item.group] = acc[item.group] || [];
        acc[item.group].push(item);
        return acc;
    }, {});

    const errorStyle = {
        border: "1px solid #ef4444",
        background: "#3f0d0d",
    };

    function fieldStyle(key) {
        return errors[key] ? errorStyle : {};
    }

    function errorText(key) {
        return errors[key]
            ? React.createElement(
                "div",
                { style: { color: "#ef4444", fontSize: "12px" } },
                errors[key]
            )
            : null;
    }

    return React.createElement(
        "div",
        {
            style: {
                fontFamily: "system-ui",
                background: "#020617",
                color: "#e5e7eb",
                minHeight: "100vh",
                padding: "20px",
            },
        },

        // header
        React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between" } },
            React.createElement("h1", null, "Kukana - Uptime Dashboard"),
            React.createElement(
                "button",
                { onClick: () => setMode(mode === "dashboard" ? "config" : "dashboard") },
                mode === "dashboard" ? "Edit Config" : "Back"
            )
        ),

        // dashboard
        mode === "dashboard" &&
        Object.entries(grouped).map(([groupName, items]) =>
            React.createElement(
                "div",
                { key: groupName, style: { marginBottom: "24px" } },

                // group title
                React.createElement(
                    "h2",
                    { style: { marginBottom: "10px" } },
                    groupName
                ),

                // grid of cards
                React.createElement(
                    "div",
                    {
                        style: {
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(240px, 1fr))",
                            gap: "14px",
                        },
                    },
                    items.map((item) =>
                        React.createElement(StatusCard, {
                            key: item.name,
                            item,
                            history: historyMap,
                        })
                    )
                )
            )
        ),

        // editor
        mode === "config" &&
        React.createElement(
            "div",
            null,

            config.groups.map((g, gi) =>
                React.createElement(
                    "div",
                    { key: gi, style: { marginBottom: "20px" } },

                    React.createElement("input", {
                        value: g.name,
                        placeholder: "Group name",
                        style: fieldStyle(`group-${gi}-name`),
                        onChange: (e) => updateGroupName(gi, e.target.value),
                    }),
                    errorText(`group-${gi}-name`),

                    g.targets.map((t, ti) =>
                        React.createElement(
                            "div",
                            { key: ti, style: { marginTop: "10px" } },

                            React.createElement("input", {
                                placeholder: "Name",
                                value: t.name,
                                style: fieldStyle(`g-${gi}-t-${ti}-name`),
                                onChange: (e) =>
                                    updateTarget(gi, ti, "name", e.target.value),
                            }),
                            errorText(`g-${gi}-t-${ti}-name`),

                            React.createElement(
                                "select",
                                {
                                    value: t.type,
                                    onChange: (e) =>
                                        updateTarget(gi, ti, "type", e.target.value),
                                },
                                React.createElement("option", { value: "http" }, "HTTP"),
                                React.createElement("option", { value: "tcp" }, "TCP")
                            ),

                            t.type === "http" &&
                            React.createElement(
                                "div",
                                null,
                                React.createElement("input", {
                                    placeholder: "URL",
                                    value: t.url || "",
                                    style: fieldStyle(`g-${gi}-t-${ti}-url`),
                                    onChange: (e) =>
                                        updateTarget(gi, ti, "url", e.target.value),
                                }),
                                errorText(`g-${gi}-t-${ti}-url`)
                            ),

                            t.type === "tcp" &&
                            React.createElement(
                                "div",
                                null,
                                React.createElement("input", {
                                    placeholder: "Host",
                                    value: t.host || "",
                                    style: fieldStyle(`g-${gi}-t-${ti}-host`),
                                    onChange: (e) =>
                                        updateTarget(gi, ti, "host", e.target.value),
                                }),
                                errorText(`g-${gi}-t-${ti}-host`),

                                React.createElement("input", {
                                    placeholder: "Port",
                                    type: "number",
                                    value: t.port || "",
                                    style: fieldStyle(`g-${gi}-t-${ti}-port`),
                                    onChange: (e) =>
                                        updateTarget(gi, ti, "port", Number(e.target.value)),
                                }),
                                errorText(`g-${gi}-t-${ti}-port`)
                            ),

                            React.createElement(
                                "button",
                                { onClick: () => removeTarget(gi, ti) },
                                "Delete"
                            )
                        )
                    ),

                    React.createElement(
                        "button",
                        { onClick: () => addTarget(gi) },
                        "Add Target"
                    ),
                    React.createElement(
                        "button",
                        { onClick: () => removeGroup(gi) },
                        "Delete Group"
                    )
                )
            ),

            React.createElement("button", { onClick: addGroup }, "Add Group"),

            React.createElement(
                "div",
                { style: { marginTop: "20px" } },
                React.createElement(
                    "button",
                    { onClick: saveConfig, disabled: Object.keys(errors).length > 0 },
                    "Save Config"
                ),
                React.createElement(
                    "span",
                    { style: { marginLeft: "10px" } },
                    message
                )
            )
        )
    );
}

ReactDOM.createRoot(document.getElementById("root")).render(
    React.createElement(App)
);
