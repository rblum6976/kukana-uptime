import Database from "better-sqlite3";

const db = new Database("./history.db");

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS service_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    up INTEGER NOT NULL,
    latency INTEGER,
    time INTEGER NOT NULL
  )
`);

type StatusPoint = {
    time: number;
    up: boolean;
    latency: number | null;
};

type ServiceHistory = {
    name: string;
    group: string;
    points: StatusPoint[];
    uptime: number;
};

const MAX_POINTS = 50;

let currentStatus: any[] = [];

const insertStmt = db.prepare(`
    INSERT INTO service_history (name, group_name, up, latency, time)
    VALUES (?, ?, ?, ?, ?)
`);

export function setStatus(status: any[]) {
    currentStatus = status;

    for (const item of status) {
        insertStmt.run(item.name, item.group, item.up ? 1 : 0, item.latency, Date.now());
    }
}

export function getStatus() {
    return currentStatus;
}

export function getHistory() {
    // Get unique services
    const services = db.prepare("SELECT DISTINCT name, group_name FROM service_history").all() as { name: string, group_name: string }[];

    const result: ServiceHistory[] = [];

    for (const service of services) {
        const points = db.prepare(`
            SELECT time, up, latency
            FROM service_history
            WHERE name = ? AND group_name = ?
            ORDER BY time DESC
            LIMIT ?
        `).all(service.name, service.group_name, MAX_POINTS).reverse() as { time: number, up: number, latency: number | null }[];

        const statusPoints: StatusPoint[] = points.map(p => ({
            time: p.time,
            up: p.up === 1,
            latency: p.latency
        }));

        // Calculate uptime percentage (based on all history for this service)
        const counts = db.prepare(`
            SELECT COUNT(*) as total, SUM(up) as ups
            FROM service_history
            WHERE name = ? AND group_name = ?
        `).get(service.name, service.group_name) as { total: number, ups: number };

        const uptime = counts.total > 0 ? (counts.ups / counts.total) * 100 : 0;

        result.push({
            name: service.name,
            group: service.group_name,
            points: statusPoints,
            uptime: parseFloat(uptime.toFixed(2))
        });
    }

    return result;
}
