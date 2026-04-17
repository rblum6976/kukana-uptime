import { checkTarget } from "./checker";
import { getConfig } from "./config";
import { setStatus } from "./state";

export function startScheduler() {
    async function runChecks() {
        const config = getConfig();

        const results: any[] = [];

        for (const group of config.groups) {
            for (const target of group.targets) {
                const result = await checkTarget(target);

                results.push({
                    group: group.name,
                    name: target.name,
                    up: result.up,
                    latency: result.latency,
                    lastChecked: new Date().toISOString(),
                });
            }
        }

        setStatus(results);
    }

    runChecks();

    setInterval(runChecks, 30 * 1000);
}