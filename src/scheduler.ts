import { checkTarget } from "./checker";
import { getConfig } from "./config";
import { setStatus } from "./state";
import { sendAlert } from "./alerter";

let previousStatusByTarget: Record<string, boolean> = {};

export function startScheduler() {
    async function runChecks() {
        const config = getConfig();

        const results: any[] = [];
        const currentStatusByTarget: Record<string, boolean> = {};

        for (const group of config.groups) {
            for (const target of group.targets) {
                const result = await checkTarget(target);
                const checkedAt = new Date().toISOString();
                const key = `${group.name}::${target.name}`;

                results.push({
                    group: group.name,
                    name: target.name,
                    up: result.up,
                    latency: result.latency,
                    lastChecked: checkedAt,
                });

                currentStatusByTarget[key] = result.up;

                const previous = previousStatusByTarget[key];
                const isTransition = previous !== undefined && previous !== result.up;
                const alertsEnabled = target.alerts?.enabled !== false;
                const groupAlerts = group.alerts;

                if (isTransition && alertsEnabled && groupAlerts?.destination) {
                    sendAlert({
                        channel: groupAlerts.channel,
                        destination: groupAlerts.destination,
                        groupName: group.name,
                        targetName: target.name,
                        isUp: result.up,
                        checkedAt,
                    }).catch((err) => {
                        console.error("❌ Failed to send alert:", err);
                    });
                }
            }
        }

        previousStatusByTarget = currentStatusByTarget;
        setStatus(results);
    }

    runChecks();

    setInterval(runChecks, 30 * 1000);
}