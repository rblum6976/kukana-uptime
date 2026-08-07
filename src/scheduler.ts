import { checkTarget } from "./checker";
import { getConfigBySetId, getConfigSets } from "./config";
import { setStatus } from "./state";
import { sendAlert } from "./alerter";
import { GroupAlertChannel, GroupAlerts } from "./types";

type AlertDelivery = { channel: GroupAlertChannel; destination: string };

function getAlertDeliveries(alerts?: GroupAlerts): AlertDelivery[] {
    if (!alerts || alerts.channel === "none") {
        return [];
    }

    const deliveries: AlertDelivery[] = [];
    if (alerts.channel === "email" || alerts.channel === "email_sms") {
        const destination = alerts.emailDestination?.trim() ||
            (alerts.channel === "email" ? alerts.destination?.trim() : "");
        if (destination) deliveries.push({ channel: "email", destination });
    }
    if (alerts.channel === "sms" || alerts.channel === "email_sms") {
        const destination = alerts.smsDestination?.trim() ||
            (alerts.channel === "sms" ? alerts.destination?.trim() : "");
        if (destination) deliveries.push({ channel: "sms", destination });
    }
    return deliveries;
}

let previousStatusByTarget: Record<string, boolean> = {};
type TargetAlertState = {
    downSinceMs: number | null;
    consecutiveDownChecks: number;
    downAlertSent: boolean;
    lastDownAlertAtMs: number | null;
};

let targetAlertStateByKey: Record<string, TargetAlertState> = {};
let alertConfigRevision = 0;

export function refreshAlertConfiguration() {
    alertConfigRevision += 1;
    previousStatusByTarget = {};
    targetAlertStateByKey = {};
}

function getOrCreateAlertState(key: string): TargetAlertState {
    if (!targetAlertStateByKey[key]) {
        targetAlertStateByKey[key] = {
            downSinceMs: null,
            consecutiveDownChecks: 0,
            downAlertSent: false,
            lastDownAlertAtMs: null,
        };
    }
    return targetAlertStateByKey[key];
}

function getThresholdReached(state: TargetAlertState, downForMs: number, downAfterMinutes?: number, downAfterChecks?: number): boolean {
    const hasTimeThreshold = typeof downAfterMinutes === "number" && downAfterMinutes > 0;
    const hasChecksThreshold = typeof downAfterChecks === "number" && downAfterChecks > 0;
    const timeReached = hasTimeThreshold ? downForMs >= downAfterMinutes * 60 * 1000 : false;
    const checksReached = hasChecksThreshold ? state.consecutiveDownChecks >= downAfterChecks : false;

    if (!hasTimeThreshold && !hasChecksThreshold) {
        return state.consecutiveDownChecks >= 1;
    }

    return timeReached || checksReached;
}

export function startScheduler() {
    async function runChecks() {
        try {
            const cycleAlertConfigRevision = alertConfigRevision;
            const sets = getConfigSets();

            const currentStatusByTarget: Record<string, boolean> = {};
            const activeTargetKeys = new Set<string>();

            for (const set of sets) {
                let config;
                try {
                    config = getConfigBySetId(set.id);
                } catch (err) {
                    console.warn(`⚠️ Skipping removed or unknown config set: ${set.id}`);
                    continue;
                }

                const results: any[] = [];

                for (const group of config.groups) {
                    for (const target of group.targets) {
                        const result = await checkTarget(target);
                        const checkedAt = new Date().toISOString();
                        const checkedAtMs = Date.now();
                        const key = `${set.id}::${group.name}::${target.name}`;
                        activeTargetKeys.add(key);

                        results.push({
                            group: group.name,
                            name: target.name,
                            type: target.type,
                            url: target.url,
                            host: target.host,
                            up: result.up,
                            latency: result.latency,
                            lastChecked: checkedAt,
                        });

                        currentStatusByTarget[key] = result.up;

                        // A config save may occur while a network check is in progress. Do not
                        // let a result produced under the old alert config dispatch an alert.
                        if (cycleAlertConfigRevision !== alertConfigRevision) {
                            continue;
                        }

                        const previous = previousStatusByTarget[key];
                        const isTransition = previous !== undefined && previous !== result.up;
                        const alertsEnabled = target.alerts?.enabled !== false;
                        const groupAlerts = group.alerts;
                        const alertDeliveries = getAlertDeliveries(groupAlerts);
                        const alertState = getOrCreateAlertState(key);

                        if (!result.up) {
                            if (alertState.downSinceMs === null) {
                                alertState.downSinceMs = checkedAtMs;
                                alertState.consecutiveDownChecks = 1;
                            } else {
                                alertState.consecutiveDownChecks += 1;
                            }

                            if (alertsEnabled && groupAlerts && alertDeliveries.length > 0) {
                                const downForMs = checkedAtMs - alertState.downSinceMs;
                                const thresholdReached = getThresholdReached(
                                    alertState,
                                    downForMs,
                                    groupAlerts.downAfterMinutes,
                                    groupAlerts.downAfterChecks,
                                );

                                const repeatDownEveryMinutes =
                                    typeof groupAlerts.repeatDownEveryMinutes === "number" && groupAlerts.repeatDownEveryMinutes > 0
                                        ? groupAlerts.repeatDownEveryMinutes
                                        : 30;

                                const canSendRepeatDown =
                                    alertState.downAlertSent &&
                                    alertState.lastDownAlertAtMs !== null &&
                                    checkedAtMs - alertState.lastDownAlertAtMs >= repeatDownEveryMinutes * 60 * 1000;

                                const shouldSendDown = thresholdReached && (!alertState.downAlertSent || canSendRepeatDown);

                                if (shouldSendDown) {
                                    for (const delivery of alertDeliveries) {
                                        sendAlert({
                                            ...delivery,
                                            groupName: group.name,
                                            targetName: target.name,
                                            isUp: false,
                                            checkedAt,
                                            downForMs,
                                        }, () => cycleAlertConfigRevision === alertConfigRevision).catch((err) => {
                                            console.error(`❌ Failed to send DOWN ${delivery.channel} alert:`, err);
                                        });
                                    }

                                    alertState.downAlertSent = true;
                                    alertState.lastDownAlertAtMs = checkedAtMs;
                                }
                            }
                        } else {
                            if (alertsEnabled && alertDeliveries.length > 0 && alertState.downSinceMs !== null && alertState.downAlertSent) {
                                for (const delivery of alertDeliveries) {
                                    sendAlert({
                                        ...delivery,
                                        groupName: group.name,
                                        targetName: target.name,
                                        isUp: true,
                                        checkedAt,
                                        downForMs: checkedAtMs - alertState.downSinceMs,
                                    }, () => cycleAlertConfigRevision === alertConfigRevision).catch((err) => {
                                        console.error(`❌ Failed to send UP ${delivery.channel} alert:`, err);
                                    });
                                }
                            }

                            if (isTransition || alertState.downSinceMs !== null || alertState.consecutiveDownChecks > 0) {
                                alertState.downSinceMs = null;
                                alertState.consecutiveDownChecks = 0;
                                alertState.downAlertSent = false;
                                alertState.lastDownAlertAtMs = null;
                            }
                        }
                    }
                }

                setStatus(set.id, results);
            }

            targetAlertStateByKey = Object.fromEntries(
                Object.entries(targetAlertStateByKey).filter(([key]) => activeTargetKeys.has(key)),
            );

            previousStatusByTarget = currentStatusByTarget;
        } catch (err) {
            console.error("❌ Scheduler cycle failed:", err);
        }
    }

    runChecks();

    setInterval(runChecks, 30 * 1000);
}
