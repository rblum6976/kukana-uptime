import { checkTarget } from "./checker";
import { getConfig } from "./config";

async function run() {
    const config = getConfig();

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