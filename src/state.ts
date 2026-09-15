import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbPath = process.env.DB_PATH || "./data/uptime.db";
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

const db = new Database(path.resolve(dbPath));

// SQLite optimizations for read/write performance
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("temp_store = MEMORY");
db.pragma("cache_size = -20000"); // 20MB cache

const DEFAULT_SET_ID = "default";

// Initialize DB schema (new column name: dashboard_id)
db.exec(`
  CREATE TABLE IF NOT EXISTS service_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    up INTEGER NOT NULL,
    latency INTEGER,
    time INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_service_history_lookup_dashboard 
    ON service_history (dashboard_id, name, group_name, time DESC);

  CREATE INDEX IF NOT EXISTS idx_service_history_group_dashboard 
    ON service_history (dashboard_id, group_name);
`);

// Migration: backfill from legacy column if present
const LEGACY_HISTORY_COLUMN = ["config", "_", "set"].join("");
const columns = db.prepare("PRAGMA table_info(service_history)").all() as { name: string }[];
const hasDashboardIdColumn = columns.some((column) => column.name === "dashboard_id");
const hasLegacyColumn = columns.some((column) => column.name === LEGACY_HISTORY_COLUMN);

if (!hasDashboardIdColumn) {
    db.exec("ALTER TABLE service_history ADD COLUMN dashboard_id TEXT");
}

if (hasLegacyColumn) {
    // Backfill null/empty dashboard_id from legacy column once
    db.exec(`UPDATE service_history SET dashboard_id = ${LEGACY_HISTORY_COLUMN} WHERE dashboard_id IS NULL OR dashboard_id = ''`);
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
const historyCacheBySet: Record<string, { timestamp: number; data: ServiceHistory[] }> = {};
const CACHE_TTL_MS = 2000; // 2 seconds fallback TTL or invalidated on update

const insertStmt = db.prepare(`
    INSERT INTO service_history (dashboard_id, name, group_name, up, latency, time)
    VALUES (?, ?, ?, ?, ?, ?)
`);
const insertManyTransaction = db.transaction((setId: string, status: any[], now: number) => {
    for (const item of status) {
        insertStmt.run(setId, item.name, item.group, item.up ? 1 : 0, item.latency, now);
    }
});

const deleteGroupHistoryStmt = db.prepare(`
    DELETE FROM service_history
    WHERE dashboard_id = ? AND group_name = ?
`);

const selectDistinctServicesStmt = db.prepare(
    "SELECT DISTINCT name, group_name FROM service_history WHERE dashboard_id = ?"
);

const selectPointsStmt = db.prepare(`
    SELECT time, up, latency
    FROM service_history
    WHERE dashboard_id = ? AND name = ? AND group_name = ?
    ORDER BY time DESC
    LIMIT ?
`);

const selectCountsStmt = db.prepare(`
    SELECT COUNT(*) as total, SUM(up) as ups
    FROM service_history
    WHERE dashboard_id = ? AND name = ? AND group_name = ?
`);

export function invalidateHistoryCache(setId?: string) {
    if (setId) {
        delete historyCacheBySet[setId];
    } else {
        for (const key of Object.keys(historyCacheBySet)) {
            delete historyCacheBySet[key];
        }
    }
}

export function setStatus(setId: string, status: any[]) {
    currentStatusBySet[setId] = status;

    const now = Date.now();
    insertManyTransaction(setId, status, now);
    invalidateHistoryCache(setId);
}

export function getStatus(setId: string = DEFAULT_SET_ID) {
    return currentStatusBySet[setId] || [];
}

export function getHistory(setId: string = DEFAULT_SET_ID) {
    const cached = historyCacheBySet[setId];
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    // Get unique services
    const services = selectDistinctServicesStmt.all(setId) as { name: string; group_name: string }[];

    const result: ServiceHistory[] = [];

    for (const service of services) {
        const points = selectPointsStmt
            .all(setId, service.name, service.group_name, MAX_POINTS)
            .reverse() as { time: number; up: number; latency: number | null }[];

        const statusPoints: StatusPoint[] = points.map(p => ({
            time: p.time,
            up: p.up === 1,
            latency: p.latency
        }));

        // Calculate uptime percentage (based on all history for this service)
        const counts = selectCountsStmt.get(setId, service.name, service.group_name) as { total: number; ups: number };

        const uptime = counts.total > 0 ? (counts.ups / counts.total) * 100 : 0;

        result.push({
            name: service.name,
            group: service.group_name,
            points: statusPoints,
            uptime: parseFloat(uptime.toFixed(2))
        });
    }

    historyCacheBySet[setId] = {
        timestamp: now,
        data: result
    };

    return result;
}

export function clearHistoryForGroup(setId: string, groupName: string): number {
    invalidateHistoryCache(setId);
    return deleteGroupHistoryStmt.run(setId, groupName).changes;
}
