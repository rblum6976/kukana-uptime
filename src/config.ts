import fs from "fs";
import path from "path";
import { Config, ConfigSet, ConfigSetMeta, ConfigStore } from "./types";

const configPath = process.env.CONFIG || "./config.json";

const DEFAULT_SET_ID = "default";

let configStore: ConfigStore = load();

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

function saveStore() {
    fs.writeFileSync(path.resolve(configPath), JSON.stringify(configStore, null, 2));
}

export function load(): ConfigStore {
    const raw = fs.readFileSync(path.resolve(configPath), "utf-8");
    return normalizeStore(JSON.parse(raw));
}

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

    configStore = {
        sets: [
            ...configStore.sets,
            {
                id,
                name: displayName,
                config: createDefaultConfig(displayName),
            },
        ],
    };

    saveStore();
    return { id, name: displayName };
}

export function updateConfigSetName(setId: string, name: string): ConfigSetMeta {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
        throw new Error("Set name is required");
    }

    let updatedSet: ConfigSetMeta | null = null;

    configStore = {
        sets: configStore.sets.map((entry) => {
            if (entry.id !== setId) {
                return entry;
            }

            updatedSet = { id: entry.id, name: trimmedName };
            return {
                ...entry,
                name: trimmedName,
            };
        }),
    };

    if (!updatedSet) {
        throw new Error(`Unknown config set: ${setId}`);
    }

    saveStore();
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

    saveStore();
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

    saveStore();
}

export function setConfig(newConfig: Config) {
    setConfigBySetId(DEFAULT_SET_ID, newConfig);
}

export function setConfigStore(newStore: ConfigStore) {
    configStore = normalizeStore(newStore);
}