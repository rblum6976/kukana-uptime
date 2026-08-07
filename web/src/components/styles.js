export const inputBaseStyle = {
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

export const modeButtonStyle = {
    ...baseButtonStyle,
    background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
    color: "#f8fafc",
    border: "1px solid #1d4ed8",
    boxShadow: "0 8px 24px rgba(37, 99, 235, 0.35)",
};

export const actionButtonStyle = {
    ...baseButtonStyle,
    background: "#1e293b",
    color: "#e5e7eb",
};

export const dangerButtonStyle = {
    ...baseButtonStyle,
    background: "#3f0d0d",
    color: "#fecaca",
    border: "1px solid #991b1b",
};

export const errorStyle = {
    border: "1px solid #ef4444",
    background: "#3f0d0d",
};
