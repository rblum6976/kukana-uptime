import { useState } from "react";
import { actionButtonStyle, dangerButtonStyle, errorStyle, inputBaseStyle, modeButtonStyle } from "./styles";

const APP_TITLE_FALLBACK = "Kukana - Uptime Dashboard";

export function ConfigEditor({ config, errors, message, onChange, onSave, onBack }) {
    const [collapsed, setCollapsed] = useState({});

    function fieldStyle(key) {
        return errors[key] ? { ...inputBaseStyle, ...errorStyle } : inputBaseStyle;
    }

    function errorText(key) {
        return errors[key] ? <div style={{ color: "#ef4444", fontSize: "12px" }}>{errors[key]}</div> : null;
    }

    function updateGroup(groupIndex, update) {
        onChange({
            ...config,
            groups: config.groups.map((group, index) => (index === groupIndex ? update(group) : group)),
        });
    }

    function updateTarget(groupIndex, targetIndex, update) {
        updateGroup(groupIndex, (group) => ({
            ...group,
            targets: group.targets.map((target, index) => (index === targetIndex ? update(target) : target)),
        }));
    }

    function moveItem(items, index, direction) {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= items.length) return items;
        const updated = [...items];
        const [moved] = updated.splice(index, 1);
        updated.splice(nextIndex, 0, moved);
        return updated;
    }

    function moveGroup(groupIndex, direction) {
        onChange({ ...config, groups: moveItem(config.groups, groupIndex, direction) });
    }

    function moveTarget(groupIndex, targetIndex, direction) {
        updateGroup(groupIndex, (group) => ({
            ...group,
            targets: moveItem(group.targets, targetIndex, direction),
        }));
    }

    function addGroup() {
        onChange({
            ...config,
            groups: [
                ...config.groups,
                { name: "", alerts: { channel: "none", emailDestination: "", smsDestination: "" }, targets: [] },
            ],
        });
    }

    function addTarget(groupIndex) {
        updateGroup(groupIndex, (group) => ({
            ...group,
            targets: [
                ...group.targets,
                { name: "", type: "http", url: "", alerts: { enabled: true } },
            ],
        }));
    }

    return (
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
                    onChange={(event) => onChange({ ...config, appTitle: event.target.value })}
                />
            </div>

            {config.groups.map((group, groupIndex) => {
                const isCollapsed = collapsed[groupIndex] ?? true;
                return (
                    <div
                        key={groupIndex}
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
                                userSelect: "none",
                            }}
                            onClick={() => setCollapsed((current) => ({ ...current, [groupIndex]: !isCollapsed }))}
                        >
                            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#e5e7eb" }}>
                                {isCollapsed ? "▶" : "▼"} {group.name || "Unnamed Group"}
                            </div>
                            <div style={{ display: "flex", gap: "10px" }}>
                                <div style={{ display: "flex", gap: "6px" }}>
                                    <button
                                        style={{ ...actionButtonStyle, padding: "2px 8px" }}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            moveGroup(groupIndex, -1);
                                        }}
                                        disabled={groupIndex === 0}
                                    >
                                        ↑
                                    </button>
                                    <button
                                        style={{ ...actionButtonStyle, padding: "2px 8px" }}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            moveGroup(groupIndex, 1);
                                        }}
                                        disabled={groupIndex === config.groups.length - 1}
                                    >
                                        ↓
                                    </button>
                                </div>
                                <button
                                    style={dangerButtonStyle}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onChange({
                                            ...config,
                                            groups: config.groups.filter((_, index) => index !== groupIndex),
                                        });
                                    }}
                                >
                                    Delete Group
                                </button>
                            </div>
                        </div>

                        {!isCollapsed && (
                            <div style={{ marginTop: "14px" }}>
                                <div style={{ marginBottom: "8px", fontSize: "13px", color: "#94a3b8" }}>Group Name</div>
                                <input
                                    value={group.name}
                                    placeholder="Group name"
                                    style={fieldStyle(`group-${groupIndex}-name`)}
                                    onChange={(event) =>
                                        updateGroup(groupIndex, (current) => ({ ...current, name: event.target.value }))
                                    }
                                />
                                {errorText(`group-${groupIndex}-name`)}

                                <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    <select
                                        value={group.alerts?.channel || "none"}
                                        style={fieldStyle(`group-${groupIndex}-alerts-channel`)}
                                        onChange={(event) =>
                                            updateGroup(groupIndex, (current) => ({
                                                ...current,
                                                alerts: {
                                                    ...(current.alerts || { emailDestination: "", smsDestination: "" }),
                                                    channel: event.target.value,
                                                },
                                            }))
                                        }
                                    >
                                        <option value="none">None</option>
                                        <option value="email">Email</option>
                                        <option value="sms">SMS</option>
                                        <option value="email_sms">Email &amp; SMS</option>
                                    </select>
                                    {(group.alerts?.channel === "email" || group.alerts?.channel === "email_sms") && (
                                        <input
                                            value={group.alerts?.emailDestination || ""}
                                            placeholder="Email address"
                                            style={{ ...fieldStyle(`group-${groupIndex}-alerts-email`), minWidth: "260px" }}
                                            onChange={(event) =>
                                                updateGroup(groupIndex, (current) => ({
                                                    ...current,
                                                    alerts: {
                                                        ...(current.alerts || { channel: "email" }),
                                                        emailDestination: event.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    )}
                                    {(group.alerts?.channel === "sms" || group.alerts?.channel === "email_sms") && (
                                        <input
                                            value={group.alerts?.smsDestination || ""}
                                            placeholder="Phone number"
                                            style={{ ...fieldStyle(`group-${groupIndex}-alerts-sms`), minWidth: "260px" }}
                                            onChange={(event) =>
                                                updateGroup(groupIndex, (current) => ({
                                                    ...current,
                                                    alerts: {
                                                        ...(current.alerts || { channel: "sms" }),
                                                        smsDestination: event.target.value,
                                                    },
                                                }))
                                            }
                                        />
                                    )}
                                </div>
                                {errorText(`group-${groupIndex}-alerts-channel`)}
                                {errorText(`group-${groupIndex}-alerts-email`)}
                                {errorText(`group-${groupIndex}-alerts-sms`)}

                                {group.targets.map((target, targetIndex) => (
                                    <div
                                        key={targetIndex}
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
                                                    onClick={() => moveTarget(groupIndex, targetIndex, -1)}
                                                    disabled={targetIndex === 0}
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    style={{ ...actionButtonStyle, padding: "2px 8px" }}
                                                    onClick={() => moveTarget(groupIndex, targetIndex, 1)}
                                                    disabled={targetIndex === group.targets.length - 1}
                                                >
                                                    ↓
                                                </button>
                                            </div>
                                        </div>
                                        <input
                                            placeholder="Name"
                                            value={target.name}
                                            style={fieldStyle(`g-${groupIndex}-t-${targetIndex}-name`)}
                                            onChange={(event) =>
                                                updateTarget(groupIndex, targetIndex, (current) => ({
                                                    ...current,
                                                    name: event.target.value,
                                                }))
                                            }
                                        />
                                        {errorText(`g-${groupIndex}-t-${targetIndex}-name`)}

                                        <select
                                            value={target.type}
                                            style={inputBaseStyle}
                                            onChange={(event) =>
                                                updateTarget(groupIndex, targetIndex, (current) => ({
                                                    ...current,
                                                    type: event.target.value,
                                                }))
                                            }
                                        >
                                            <option value="http">HTTP</option>
                                            <option value="tcp">TCP</option>
                                            <option value="ping">Ping</option>
                                        </select>

                                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#cbd5e1" }}>
                                            <input
                                                type="checkbox"
                                                checked={target.alerts?.enabled !== false}
                                                onChange={(event) =>
                                                    updateTarget(groupIndex, targetIndex, (current) => ({
                                                        ...current,
                                                        alerts: { ...current.alerts, enabled: event.target.checked },
                                                    }))
                                                }
                                            />
                                            Alerts enabled for this target
                                        </label>

                                        {target.type === "http" && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                <input
                                                    placeholder="URL"
                                                    value={target.url || ""}
                                                    style={fieldStyle(`g-${groupIndex}-t-${targetIndex}-url`)}
                                                    onChange={(event) =>
                                                        updateTarget(groupIndex, targetIndex, (current) => ({
                                                            ...current,
                                                            url: event.target.value,
                                                        }))
                                                    }
                                                />
                                                {errorText(`g-${groupIndex}-t-${targetIndex}-url`)}
                                            </div>
                                        )}

                                        {(target.type === "tcp" || target.type === "ping") && (
                                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                                <input
                                                    placeholder="Host"
                                                    value={target.host || ""}
                                                    style={fieldStyle(`g-${groupIndex}-t-${targetIndex}-host`)}
                                                    onChange={(event) =>
                                                        updateTarget(groupIndex, targetIndex, (current) => ({
                                                            ...current,
                                                            host: event.target.value,
                                                        }))
                                                    }
                                                />
                                                {errorText(`g-${groupIndex}-t-${targetIndex}-host`)}
                                                {target.type === "tcp" && (
                                                    <>
                                                        <input
                                                            placeholder="Port"
                                                            type="number"
                                                            value={target.port || ""}
                                                            style={fieldStyle(`g-${groupIndex}-t-${targetIndex}-port`)}
                                                            onChange={(event) =>
                                                                updateTarget(groupIndex, targetIndex, (current) => ({
                                                                    ...current,
                                                                    port: Number(event.target.value),
                                                                }))
                                                            }
                                                        />
                                                        {errorText(`g-${groupIndex}-t-${targetIndex}-port`)}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                            <button
                                                style={dangerButtonStyle}
                                                onClick={() =>
                                                    updateGroup(groupIndex, (current) => ({
                                                        ...current,
                                                        targets: current.targets.filter((_, index) => index !== targetIndex),
                                                    }))
                                                }
                                            >
                                                Delete Target
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                    <button style={actionButtonStyle} onClick={() => addTarget(groupIndex)}>Add Target</button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            <button style={actionButtonStyle} onClick={addGroup}>Add Group</button>
            <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <button
                    style={{
                        ...modeButtonStyle,
                        opacity: Object.keys(errors).length > 0 ? 0.6 : 1,
                        cursor: Object.keys(errors).length > 0 ? "not-allowed" : "pointer",
                    }}
                    onClick={onSave}
                    disabled={Object.keys(errors).length > 0}
                >
                    Save Config
                </button>
                <button style={actionButtonStyle} onClick={onBack}>Back</button>
                <span style={{ color: "#cbd5e1" }}>{message}</span>
            </div>
        </div>
    );
}
