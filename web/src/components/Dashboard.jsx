import { StatusCard } from "./StatusCard";
import { dangerButtonStyle } from "./styles";

export function Dashboard({ grouped, history, message, clearingGroup, onClearHistory }) {
    return (
        <>
            {message && <div style={{ marginBottom: "12px", color: "#cbd5e1", fontSize: "13px" }}>{message}</div>}
            {Object.entries(grouped).map(([groupName, items]) => (
                <div key={groupName} style={{ marginBottom: "24px" }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            marginBottom: "10px",
                        }}
                    >
                        <h2 style={{ margin: 0 }}>{groupName}</h2>
                        <button
                            style={{ ...dangerButtonStyle, padding: "6px 10px", fontSize: "12px" }}
                            disabled={clearingGroup !== null}
                            onClick={() => onClearHistory(groupName)}
                        >
                            {clearingGroup === groupName ? "Clearing…" : "Clear History"}
                        </button>
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                            gap: "14px",
                        }}
                    >
                        {items.map((item) => (
                            <StatusCard key={`${item.group}-${item.name}`} item={item} history={history} />
                        ))}
                    </div>
                </div>
            ))}
        </>
    );
}
