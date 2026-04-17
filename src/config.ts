import fs from "fs";
import path from "path";

export type Config = any;

const configPath = process.env.CONFIG || "./config.json";

let config: Config = load();

export function load() {
    const raw = fs.readFileSync(path.resolve(configPath), "utf-8");
    return JSON.parse(raw);
}

export function getConfig() {
    return config;
}

export function setConfig(newConfig: Config) {
    config = newConfig;
}