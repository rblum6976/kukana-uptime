import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { Config, ConfigSet, ConfigSetMeta, ConfigStore } from "./types";

const dbPath = process.env.DB_PATH || "./data/uptime.db";

const DEFAULT_SET_ID = "default";

fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

const db = new Database(path.resolve(dbPath));

db.exec(`
  CREATE TABLE IF NOT EXISTS config_sets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    config_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

const selectSetsStmt = db.prepare("SELECT id, name, config_json FROM config_sets ORDER BY rowid ASC");
const insertSetStmt = db.prepare(
    "INSERT INTO config_sets (id, name, config_json, updated_at) VALUES (?, ?, ?, ?)",
);
const updateSetNameStmt = db.prepare("UPDATE config_sets SET name = ?, updated_at = ? WHERE id = ?");
const updateSetConfigStmt = db.prepare("UPDATE config_sets SET config_json = ?, updated_at = ? WHERE id = ?");
const deleteSetStmt = db.prepare("DELETE FROM config_sets WHERE id = ?");
const clearSetsStmt = db.prepare("DELETE FROM config_sets");

let configStore: ConfigStore;

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
                ? {
                      channel: group.alerts.channel,
                      destination: group.alerts.destination,
                      downAfterMinutes: toPositiveNumber(group.alerts.downAfterMinutes),
                      downAfterChecks: toPositiveNumber(group.alerts.downAfterChecks),
                      repeatDownEveryMinutes: toPositiveNumber(group.alerts.repeatDownEveryMinutes),
                  }
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

function normalizeStore(rawStore: any): ConfigStore {
    if (rawStore && Array.isArray(rawStore.groups)) {
        return {
            sets: [
                {
                    id: DEFAULT_SET_ID,
                    name: "Default",
                    config: normalizeConfig(rawStore),
                },
            ],
        };
    }

    const rawSets = Array.isArray(rawStore?.sets) ? rawStore.sets : [];
    const usedIds = new Set<string>();
    const sets: ConfigSet[] = rawSets.map((rawSet: any, index: number) => {
        const fallbackName = `Set ${index + 1}`;
        const name = typeof rawSet?.name === "string" && rawSet.name.trim() ? rawSet.name.trim() : fallbackName;
        const requestedId = typeof rawSet?.id === "string" && rawSet.id.trim() ? rawSet.id : name;
        const id = ensureUniqueId(requestedId, usedIds);
        usedIds.add(id);

        return {
            id,
            name,
            config: normalizeConfig(rawSet?.config ?? rawSet),
        };
    });

    if (sets.length === 0) {
        sets.push({
            id: DEFAULT_SET_ID,
            name: "Default",
            config: createDefaultConfig("Default"),
        });
    }

    return { sets };
}

function persistStoreToDb(store: ConfigStore) {
    const now = Date.now();
    const insertMany = db.transaction((sets: ConfigSet[]) => {
        clearSetsStmt.run();
        for (const set of sets) {
            insertSetStmt.run(set.id, set.name, JSON.stringify(set.config), now);
        }
    });

    insertMany(store.sets);
}

function readStoreFromDb(): ConfigStore {
    const rows = selectSetsStmt.all() as { id: string; name: string; config_json: string }[];
    return normalizeStore({
        sets: rows.map((row) => {
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

export function load(): ConfigStore {
    const dbStore = readStoreFromDb();
    if (dbStore.sets.length > 0) {
        configStore = dbStore;
        return dbStore;
    }

    const initialStore = normalizeStore(undefined);

    persistStoreToDb(initialStore);
    configStore = initialStore;
    return initialStore;
}

configStore = load();

export function getConfig(): Config {
    return getConfigBySetId(DEFAULT_SET_ID);
}

export function getConfigSets(): ConfigSetMeta[] {
    return configStore.sets.map((set) => ({ id: set.id, name: set.name }));
}

export function hasConfigSet(setId: string): boolean {
    return configStore.sets.some((set) => set.id === setId);
}

export function getConfigBySetId(setId: string): Config {
    const set = configStore.sets.find((entry) => entry.id === setId);
    if (!set) {
        throw new Error(`Unknown config set: ${setId}`);
    }
    return set.config;
}

export function addConfigSet(name: string, requestedId?: string): ConfigSetMeta {
    const used = new Set(configStore.sets.map((set) => set.id));
    const id = ensureUniqueId(requestedId || name || "set", used);
    const displayName = typeof name === "string" && name.trim() ? name.trim() : `Set ${configStore.sets.length + 1}`;

    const newSet: ConfigSet = {
        id,
        name: displayName,
        config: createDefaultConfig(displayName),
    };

    configStore = {
        sets: [...configStore.sets, newSet],
    };

    insertSetStmt.run(newSet.id, newSet.name, JSON.stringify(newSet.config), Date.now());
    return { id, name: displayName };
}

export function updateConfigSetName(setId: string, name: string): ConfigSetMeta {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
        throw new Error("Set name is required");
    }

    let updatedSet: ConfigSetMeta | null = null;

    const existing = configStore.sets.find((entry) => entry.id === setId);
    if (!existing) {
        throw new Error(`Unknown config set: ${setId}`);
    }

    configStore = {
        sets: configStore.sets.map((entry) => (entry.id === setId ? { ...entry, name: trimmedName } : entry)),
    };

    updatedSet = { id: existing.id, name: trimmedName };
    updateSetNameStmt.run(trimmedName, Date.now(), setId);

    if (!updatedSet) {
        throw new Error(`Unknown config set: ${setId}`);
    }

    return updatedSet;
}

export function deleteConfigSet(setId: string) {
    if (!hasConfigSet(setId)) {
        throw new Error(`Unknown config set: ${setId}`);
    }

    if (configStore.sets.length <= 1) {
        throw new Error("At least one configuration set is required");
    }

    configStore = {
        sets: configStore.sets.filter((entry) => entry.id !== setId),
    };

    deleteSetStmt.run(setId);
}

export function setConfigBySetId(setId: string, newConfig: Config) {
    const normalizedConfig = normalizeConfig(newConfig);
    let updated = false;

    configStore = {
        sets: configStore.sets.map((entry) => {
            if (entry.id !== setId) {
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
        throw new Error(`Unknown config set: ${setId}`);
    }

    updateSetConfigStmt.run(JSON.stringify(normalizedConfig), Date.now(), setId);
}

export function setConfig(newConfig: Config) {
    setConfigBySetId(DEFAULT_SET_ID, newConfig);
}

export function setConfigStore(newStore: ConfigStore) {
    const normalized = normalizeStore(newStore);
    persistStoreToDb(normalized);
    configStore = normalized;
}