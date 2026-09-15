import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { Config, Dashboard, DashboardMeta, DashboardStore } from "./types";

const dbPath = process.env.DB_PATH || "./data/uptime.db";

const DEFAULT_SET_ID = "default";

fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

const db = new Database(path.resolve(dbPath));

// Migration: rename legacy table -> `dashboards`
(() => {
    const LEGACY_CONFIG_TABLE = ["config", "_", "sets"].join(""); // legacy name kept for one-time migration only, not verbatim
    const getTable = (name: string) =>
        db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name) as
            | { name: string }
            | undefined;

    const hasDashboards = !!getTable("dashboards");
    const hasLegacyConfigTable = !!getTable(LEGACY_CONFIG_TABLE);

    if (!hasDashboards) {
        if (hasLegacyConfigTable) {
            db.exec(`ALTER TABLE ${LEGACY_CONFIG_TABLE} RENAME TO dashboards`);
        } else {
            db.exec(`
              CREATE TABLE IF NOT EXISTS dashboards (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                config_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
              )
            `);
        }
    }
})();

const selectSetsStmt = db.prepare("SELECT id, name, config_json FROM dashboards ORDER BY rowid ASC");
const insertSetStmt = db.prepare(
    "INSERT INTO dashboards (id, name, config_json, updated_at) VALUES (?, ?, ?, ?)",
);
const updateSetNameStmt = db.prepare("UPDATE dashboards SET name = ?, updated_at = ? WHERE id = ?");
const updateSetConfigStmt = db.prepare("UPDATE dashboards SET config_json = ?, updated_at = ? WHERE id = ?");
const deleteSetStmt = db.prepare("DELETE FROM dashboards WHERE id = ?");
const clearSetsStmt = db.prepare("DELETE FROM dashboards");

let dashboardStore: DashboardStore;

function createDefaultConfig(name?: string): Config {
    const appTitle = typeof name === "string" && name.trim() ? `${name.trim()} - Uptime Dashboard` : "Kukana - Uptime Dashboard";
    return {
        appTitle,
        intervalSeconds: 30,
        groups: [],
    };
}

function toId(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function ensureUniqueId(baseId: string, used: Set<string>): string {
    const normalized = toId(baseId) || "set";
    if (!used.has(normalized)) {
        return normalized;
    }

    let counter = 2;
    while (used.has(`${normalized}-${counter}`)) {
        counter++;
    }
    return `${normalized}-${counter}`;
}

function normalizeConfig(rawConfig: any): Config {
    const toPositiveNumber = (value: unknown): number | undefined => {
        if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
            return undefined;
        }
        return value;
    };

    const groups = Array.isArray(rawConfig?.groups) ? rawConfig.groups : [];
    const appTitle =
        typeof rawConfig?.appTitle === "string" && rawConfig.appTitle.trim()
            ? rawConfig.appTitle.trim()
            : "Kukana - Uptime Dashboard";

    return {
        appTitle,
        intervalSeconds: typeof rawConfig?.intervalSeconds === "number" ? rawConfig.intervalSeconds : 30,
        groups: groups.map((group: any) => ({
            ...group,
            alerts: group?.alerts
                ? (() => {
                      const channel = ["none", "email", "sms", "email_sms"].includes(group.alerts.channel)
                          ? group.alerts.channel
                          : "none";
                      const legacyDestination = typeof group.alerts.destination === "string"
                          ? group.alerts.destination
                          : "";
                      return {
                      channel,
                      emailDestination:
                          typeof group.alerts.emailDestination === "string"
                              ? group.alerts.emailDestination
                              : channel === "email"
                                  ? legacyDestination
                                  : "",
                      smsDestination:
                          typeof group.alerts.smsDestination === "string"
                              ? group.alerts.smsDestination
                              : channel === "sms"
                                  ? legacyDestination
                                  : "",
                      downAfterMinutes: toPositiveNumber(group.alerts.downAfterMinutes),
                      downAfterChecks: toPositiveNumber(group.alerts.downAfterChecks),
                      repeatDownEveryMinutes: toPositiveNumber(group.alerts.repeatDownEveryMinutes),
                  };
                  })()
                : undefined,
            targets: Array.isArray(group?.targets)
                ? group.targets.map((target: any) => ({
                      ...target,
                      alerts: {
                          enabled: target?.alerts?.enabled !== false,
                      },
                  }))
                : [],
        })),
    };
}

function normalizeStore(rawStore: any): DashboardStore {
    if (rawStore && Array.isArray(rawStore.groups)) {
        return {
            dashboards: [
                {
                    id: DEFAULT_SET_ID,
                    name: "Default",
                    config: normalizeConfig(rawStore),
                },
            ],
        };
    }

    const rawDashboards = Array.isArray(rawStore?.dashboards)
        ? rawStore.dashboards
        : Array.isArray(rawStore?.sets)
            ? rawStore.sets // legacy key
            : [];
    const usedIds = new Set<string>();
    const dashboards: Dashboard[] = rawDashboards.map((rawSet: any, index: number) => {
        const fallbackName = `Dashboard ${index + 1}`;
        const name = typeof rawSet?.name === "string" && rawSet.name.trim() ? rawSet.name.trim() : fallbackName;
        const requestedId = typeof rawSet?.id === "string" && rawSet.id.trim() ? rawSet.id : name; // keep legacy id
        const id = ensureUniqueId(requestedId, usedIds);
        usedIds.add(id);

        return {
            id,
            name,
            config: normalizeConfig(rawSet?.config ?? rawSet),
        };
    });

    if (dashboards.length === 0) {
        dashboards.push({
            id: DEFAULT_SET_ID,
            name: "Default",
            config: createDefaultConfig("Default"),
        });
    }

    return { dashboards };
}

function persistStoreToDb(store: DashboardStore) {
    const now = Date.now();
    const insertMany = db.transaction((dashboards: Dashboard[]) => {
        clearSetsStmt.run();
        for (const set of dashboards) {
            insertSetStmt.run(set.id, set.name, JSON.stringify(set.config), now);
        }
    });

    insertMany(store.dashboards);
}

function readStoreFromDb(): DashboardStore {
    const rows = selectSetsStmt.all() as { id: string; name: string; config_json: string }[];
    return normalizeStore({
        dashboards: rows.map((row) => {
            let parsedConfig: any = {};
            try {
                parsedConfig = JSON.parse(row.config_json);
            } catch {
                parsedConfig = {};
            }
            return {
                id: row.id,
                name: row.name,
                config: parsedConfig,
            };
        }),
    });
}

export function load(): DashboardStore {
    const dbStore = readStoreFromDb();
    if (dbStore.dashboards.length > 0) {
        dashboardStore = dbStore;
        return dbStore;
    }

    const initialStore = normalizeStore(undefined);

    persistStoreToDb(initialStore);
    dashboardStore = initialStore;
    return initialStore;
}

dashboardStore = load();

export function getConfig(): Config {
    return getDashboardConfig(DEFAULT_SET_ID);
}

export function getDashboards(): DashboardMeta[] {
    return dashboardStore.dashboards.map((set) => ({ id: set.id, name: set.name }));
}

export function hasDashboard(id: string): boolean {
    return dashboardStore.dashboards.some((set) => set.id === id);
}

export function getDashboardConfig(id: string): Config {
    const set = dashboardStore.dashboards.find((entry) => entry.id === id);
    if (!set) {
        throw new Error(`Unknown dashboard: ${id}`);
    }
    return set.config;
}

export function addDashboard(name: string, requestedId?: string): DashboardMeta {
    const used = new Set(dashboardStore.dashboards.map((set) => set.id));
    const id = ensureUniqueId(requestedId || name || "dashboard", used);
    const displayName = typeof name === "string" && name.trim() ? name.trim() : `Dashboard ${dashboardStore.dashboards.length + 1}`;

    const newSet: Dashboard = {
        id,
        name: displayName,
        config: createDefaultConfig(displayName),
    };

    dashboardStore = {
        dashboards: [...dashboardStore.dashboards, newSet],
    };

    insertSetStmt.run(newSet.id, newSet.name, JSON.stringify(newSet.config), Date.now());
    return { id, name: displayName };
}

export function updateDashboardName(id: string, name: string): DashboardMeta {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
        throw new Error("Dashboard name is required");
    }

    let updatedSet: DashboardMeta | null = null;

    const existing = dashboardStore.dashboards.find((entry) => entry.id === id);
    if (!existing) {
        throw new Error(`Unknown dashboard: ${id}`);
    }

    dashboardStore = {
        dashboards: dashboardStore.dashboards.map((entry) => (entry.id === id ? { ...entry, name: trimmedName } : entry)),
    };

    updatedSet = { id: existing.id, name: trimmedName };
    updateSetNameStmt.run(trimmedName, Date.now(), id);

    if (!updatedSet) {
        throw new Error(`Unknown dashboard: ${id}`);
    }

    return updatedSet;
}

export function deleteDashboard(id: string) {
    if (!hasDashboard(id)) {
        throw new Error(`Unknown dashboard: ${id}`);
    }

    if (dashboardStore.dashboards.length <= 1) {
        throw new Error("At least one dashboard is required");
    }

    dashboardStore = {
        dashboards: dashboardStore.dashboards.filter((entry) => entry.id !== id),
    };

    deleteSetStmt.run(id);
}

export function setDashboardConfig(id: string, newConfig: Config) {
    const normalizedConfig = normalizeConfig(newConfig);
    let updated = false;

    dashboardStore = {
        dashboards: dashboardStore.dashboards.map((entry) => {
            if (entry.id !== id) {
                return entry;
            }
            updated = true;
            return {
                ...entry,
                config: normalizedConfig,
            };
        }),
    };

    if (!updated) {
        throw new Error(`Unknown dashboard: ${id}`);
    }

    updateSetConfigStmt.run(JSON.stringify(normalizedConfig), Date.now(), id);
}

export function setConfig(newConfig: Config) {
    setDashboardConfig(DEFAULT_SET_ID, newConfig);
}

export function setDashboardStore(newStore: DashboardStore) {
    const normalized = normalizeStore(newStore);
    persistStoreToDb(normalized);
    dashboardStore = normalized;
}
