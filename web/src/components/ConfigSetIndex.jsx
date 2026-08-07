import { useState } from "react";
import { actionButtonStyle, dangerButtonStyle, inputBaseStyle, modeButtonStyle } from "./styles";

function Dialog({ title, description, error, children, onClose, onSubmit, submitLabel, danger = false }) {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(2, 6, 23, 0.75)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                zIndex: 1000,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "460px",
                    background: "#0b1224",
                    border: "1px solid #1e293b",
                    borderRadius: "14px",
                    padding: "16px",
                    display: "grid",
                    gap: "10px",
                }}
                onClick={(event) => event.stopPropagation()}
            >
                <div style={{ fontSize: "16px", fontWeight: 700 }}>{title}</div>
                <div style={{ fontSize: "13px", color: "#94a3b8" }}>{description}</div>
                {children}
                {error && <div style={{ color: "#ef4444", fontSize: "12px" }}>❌ {error}</div>}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <button style={actionButtonStyle} onClick={onClose}>Cancel</button>
                    <button style={danger ? dangerButtonStyle : modeButtonStyle} onClick={onSubmit}>{submitLabel}</button>
                </div>
            </div>
        </div>
    );
}

export function ConfigSetIndex({ sets, onNavigate, onRefresh }) {
    const [dialog, setDialog] = useState(null);
    const [selectedSet, setSelectedSet] = useState(null);
    const [name, setName] = useState("");
    const [error, setError] = useState("");

    function closeDialog() {
        setDialog(null);
        setSelectedSet(null);
        setName("");
        setError("");
    }

    function openDialog(type, set = null) {
        setDialog(type);
        setSelectedSet(set);
        setName(set?.name || "");
        setError("");
    }

    async function createSet() {
        if (!name.trim()) {
            setError("Enter a set name");
            return;
        }
        try {
            const response = await fetch("/api/config-sets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });
            if (!response.ok) throw new Error();
            const created = await response.json();
            closeDialog();
            await onRefresh();
            onNavigate(created.id);
        } catch {
            setError("Failed to create configuration set");
        }
    }

    async function editSet() {
        if (!selectedSet || !name.trim()) {
            setError("Enter a set name");
            return;
        }
        try {
            const response = await fetch(`/api/config-sets/${encodeURIComponent(selectedSet.id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });
            if (!response.ok) throw new Error();
            closeDialog();
            await onRefresh();
        } catch {
            setError("Failed to update configuration set");
        }
    }

    async function deleteSet() {
        if (!selectedSet) return;
        try {
            const response = await fetch(`/api/config-sets/${encodeURIComponent(selectedSet.id)}`, { method: "DELETE" });
            if (!response.ok) throw new Error();
            closeDialog();
            await onRefresh();
        } catch {
            setError("Failed to delete configuration set");
        }
    }

    const nameInput = (
        <input
            value={name}
            placeholder="Set name"
            style={inputBaseStyle}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
                if (event.key === "Enter") {
                    dialog === "create" ? createSet() : editSet();
                }
            }}
        />
    );

    return (
        <>
            <div
                style={{
                    background: "#0b1224",
                    border: "1px solid #1e293b",
                    borderRadius: "14px",
                    padding: "16px",
                    display: "grid",
                    gap: "16px",
                }}
            >
                <div style={{ color: "#94a3b8", fontSize: "14px" }}>Select a configuration set or create a new one.</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
                    {sets.map((set) => (
                        <div
                            key={set.id}
                            style={{
                                background: "#082f49",
                                border: "1px solid #0ea5e9",
                                borderRadius: "12px",
                                padding: "14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                cursor: "pointer",
                                color: "#e0f2fe",
                            }}
                            role="button"
                            tabIndex={0}
                            onClick={() => onNavigate(set.id)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    onNavigate(set.id);
                                }
                            }}
                        >
                            <div style={{ fontWeight: 700, fontSize: "16px" }}>{set.name}</div>
                            <div style={{ color: "#bae6fd", fontSize: "12px" }}>{set.id}</div>
                            <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
                                <button
                                    style={{ ...actionButtonStyle, padding: "6px 10px", background: "#0f172a", color: "#cbd5e1" }}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        openDialog("edit", set);
                                    }}
                                >
                                    Edit
                                </button>
                                <button
                                    style={{ ...dangerButtonStyle, padding: "6px 10px" }}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        openDialog("delete", set);
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div><button style={modeButtonStyle} onClick={() => openDialog("create")}>Create Set</button></div>
            </div>

            {dialog === "create" && (
                <Dialog title="Create configuration set" description="Enter a name. The set ID will be generated automatically." error={error} onClose={closeDialog} onSubmit={createSet} submitLabel="Create Set">
                    {nameInput}
                </Dialog>
            )}
            {dialog === "edit" && selectedSet && (
                <Dialog title="Edit configuration set" description={`Update the set name for ${selectedSet.id}.`} error={error} onClose={closeDialog} onSubmit={editSet} submitLabel="Save">
                    {nameInput}
                </Dialog>
            )}
            {dialog === "delete" && selectedSet && (
                <Dialog title="Delete configuration set" description={`Are you sure you want to delete ${selectedSet.name}? This cannot be undone.`} error={error} onClose={closeDialog} onSubmit={deleteSet} submitLabel="Delete" danger />
            )}
        </>
    );
}
