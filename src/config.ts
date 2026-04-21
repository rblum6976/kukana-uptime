import fs from "fs";
import path from "path";
import { Config } from "./types";

const configPath = process.env.CONFIG || "./config.json";

let config: Config = load();

function normalizeConfig(rawConfig: any): Config {
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

export function load(): Config {
    const raw = fs.readFileSync(path.resolve(configPath), "utf-8");
    return normalizeConfig(JSON.parse(raw));
}

export function getConfig(): Config {
    return config;
}

export function setConfig(newConfig: Config) {
    config = normalizeConfig(newConfig);
}