import { GroupAlertChannel } from "./types";

type AlertPayload = {
    channel: GroupAlertChannel;
    destination: string;
    groupName: string;
    targetName: string;
    isUp: boolean;
    checkedAt: string;
};

function formatMessage(payload: AlertPayload) {
    const state = payload.isUp ? "RECOVERED (UP)" : "DOWN";
    return `[Kukana Uptime] ${payload.groupName} / ${payload.targetName} is ${state} at ${payload.checkedAt}`;
}

async function sendEmailAlert(payload: AlertPayload) {
    const from = process.env.ALERT_FROM_EMAIL || "kukana-uptime@localhost";
    const message = formatMessage(payload);

    console.log("📧 Email alert", {
        to: payload.destination,
        from,
        subject: `[Kukana Uptime] ${payload.targetName} status changed`,
        message,
    });
}

async function sendSmsAlert(payload: AlertPayload) {
    const message = formatMessage(payload);
    console.log("📱 SMS alert (placeholder)", {
        to: payload.destination,
        message,
    });
}

export async function sendAlert(payload: AlertPayload) {
    if (payload.channel === "email") {
        await sendEmailAlert(payload);
        return;
    }

    await sendSmsAlert(payload);
}
