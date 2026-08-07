import { useState } from "react";

function Sparkline({ points }) {
    const width = 120;
    const height = 30;
    const [hoverPoint, setHoverPoint] = useState(null);

    if (!points || points.length < 2) {
        return (
            <svg width={width} height={height} aria-label="No history">
                <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="#475569" strokeWidth="1" />
            </svg>
        );
    }

    const maxLatency = Math.max(...points.map((point) => point.latency || 0), 1);
    const segments = [];
    for (let index = 0; index < points.length - 1; index++) {
        const first = points[index];
        const second = points[index + 1];
        segments.push({
            x1: (index / (points.length - 1)) * width,
            y1: height - ((first.latency || 0) / maxLatency) * height,
            x2: ((index + 1) / (points.length - 1)) * width,
            y2: height - ((second.latency || 0) / maxLatency) * height,
            color: second.up ? "#22c55e" : "#ef4444",
            point: second,
        });
    }

    return (
        <div style={{ position: "relative" }}>
            <svg width={width} height={height} onMouseLeave={() => setHoverPoint(null)} style={{ overflow: "visible" }}>
                {segments.map((segment, index) => (
                    <line
                        key={index}
                        x1={segment.x1}
                        y1={segment.y1}
                        x2={segment.x2}
                        y2={segment.y2}
                        stroke={segment.color}
                        strokeWidth={2}
                        onMouseEnter={() => setHoverPoint(segment.point)}
                    />
                ))}
                {segments.map((segment, index) => (
                    <circle
                        key={`c-${index}`}
                        cx={segment.x2}
                        cy={segment.y2}
                        r={3}
                        fill="transparent"
                        onMouseEnter={() => setHoverPoint(segment.point)}
                    />
                ))}
            </svg>
            {hoverPoint && (
                <div
                    style={{
                        position: "absolute",
                        top: "-40px",
                        left: 0,
                        background: "#1e293b",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "10px",
                        whiteSpace: "nowrap",
                        zIndex: 10,
                        border: "1px solid #334155",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                    }}
                >
                    {new Date(hoverPoint.time).toLocaleTimeString()} - {hoverPoint.latency ?? "N/A"}ms
                </div>
            )}
        </div>
    );
}

export function StatusCard({ item, history }) {
    const color = item.up ? "#22c55e" : "#ef4444";
    const historyItem = history[`${item.group}::${item.name}`];
    const points = historyItem?.points || [];
    const uptime = historyItem?.uptime ?? 0;
    let hostname = item.host || "";

    if (item.type === "http" && item.url) {
        try {
            hostname = new URL(item.url).host;
        } catch {
            hostname = item.url;
        }
    }

    return (
        <div
            style={{
                background: item.up ? "#052e16" : "#3f0d0d",
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
            <div style={{ fontSize: "10px", opacity: 0.6 }}>{new Date(item.lastChecked).toLocaleTimeString()}</div>
            {hostname && (
                <div style={{ fontSize: "11px", marginTop: "2px", overflowWrap: "anywhere" }}>
                    {item.type === "http" && item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "#7dd3fc" }}>
                            {hostname}
                        </a>
                    ) : (
                        <span style={{ color: "#94a3b8" }}>{hostname}</span>
                    )}
                </div>
            )}
        </div>
    );
}
