import fs from "fs";
import path from "path";
import { checkTarget } from "./checker";
import { Config } from "./types";

const configPath = process.env.CONFIG || "./config.json";

function loadConfig(): Config {
    const raw = fs.readFileSync(path.resolve(configPath), "utf-8");
    return JSON.parse(raw);
}

async function run() {
    const config = loadConfig();

    console.log(`Starting uptime checker (Ver. ${process.env.APP_VERSION})...`);

    setInterval(async () => {
        console.log(`\nCheck at ${new Date().toISOString()}`);

        for (const group of config.groups) {
            for (const target of group.targets) {
                const isUp = await checkTarget(target);

                console.log(
                    `${target.name} → ${isUp ? "✅ UP" : "❌ DOWN"}`
                );
            }
        }
    }, config.intervalSeconds * 1000);
}

run();