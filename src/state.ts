import Database from "better-sqlite3";

const db = new Database("./history.db");

const DEFAULT_SET_ID = "default";

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS service_history (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    config_set TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    up INTEGER NOT NULL,
    latency INTEGER,
    time INTEGER NOT NULL
  )
`);

const columns = db.prepare("PRAGMA table_info(service_history)").all() as { name: string }[];
const hasConfigSetColumn = columns.some((column) => column.name === "config_set");
if (!hasConfigSetColumn) {
    db.exec("ALTER TABLE service_history ADD COLUMN config_set TEXT NOT NULL DEFAULT 'default'");
}

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

const currentStatusBySet: Record<string, any[]> = {};

const insertStmt = db.prepare(`
    INSERT INTO service_history (config_set, name, group_name, up, latency, time)
    VALUES (?, ?, ?, ?, ?, ?)
`);

export function setStatus(setId: string, status: any[]) {
    currentStatusBySet[setId] = status;

    for (const item of status) {
        insertStmt.run(setId, item.name, item.group, item.up ? 1 : 0, item.latency, Date.now());
    }
}

export function getStatus(setId: string = DEFAULT_SET_ID) {
    return currentStatusBySet[setId] || [];
}

export function getHistory(setId: string = DEFAULT_SET_ID) {
    // Get unique services
    const services = db
        .prepare("SELECT DISTINCT name, group_name FROM service_history WHERE config_set = ?")
        .all(setId) as { name: string; group_name: string }[];

    const result: ServiceHistory[] = [];

    for (const service of services) {
        const points = db.prepare(`
            SELECT time, up, latency
            FROM service_history
            WHERE config_set = ? AND name = ? AND group_name = ?
            ORDER BY time DESC
            LIMIT ?
        `).all(setId, service.name, service.group_name, MAX_POINTS).reverse() as { time: number, up: number, latency: number | null }[];

        const statusPoints: StatusPoint[] = points.map(p => ({
            time: p.time,
            up: p.up === 1,
            latency: p.latency
        }));

        // Calculate uptime percentage (based on all history for this service)
        const counts = db.prepare(`
            SELECT COUNT(*) as total, SUM(up) as ups
            FROM service_history
            WHERE config_set = ? AND name = ? AND group_name = ?
        `).get(setId, service.name, service.group_name) as { total: number, ups: number };

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
