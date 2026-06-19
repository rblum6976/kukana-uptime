import { GroupAlertChannel } from "./types";

type AlertPayload = {
    channel: GroupAlertChannel;
    destination: string;
    groupName: string;
    targetName: string;
    isUp: boolean;
    checkedAt: string;
    downForMs?: number;
};

type EmailDeliveryResult = {
    sent: boolean;
    reason?: "smtp_not_configured";
};

function formatDuration(durationMs: number) {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) {
        parts.push(`${hours}h`);
    }
    if (minutes > 0 || hours > 0) {
        parts.push(`${minutes}m`);
    }
    parts.push(`${seconds}s`);
    return parts.join(" ");
}

function formatMessage(payload: AlertPayload) {
    const state = payload.isUp ? "RECOVERED (UP)" : "DOWN";
    const base = `[Kukana Uptime] ${payload.groupName} / ${payload.targetName} is ${state} at ${payload.checkedAt}`;
    if (payload.isUp && typeof payload.downForMs === "number") {
        return `${base}. Downtime: ${formatDuration(payload.downForMs)}.`;
    }
    return base;
}

async function sendEmailViaSmtp(payload: AlertPayload, message: string): Promise<EmailDeliveryResult> {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 0);
    const from = process.env.ALERT_FROM_EMAIL || "kukana-uptime@localhost";

    if (!host || !port) {
        console.warn("⚠️ Email alert skipped: SMTP_HOST/SMTP_PORT not configured", {
            to: payload.destination,
            message,
        });
        return {
            sent: false,
            reason: "smtp_not_configured",
        };
    }

    const subject = payload.isUp
        ? `[Kukana Uptime] ${payload.targetName} recovered`
        : `[Kukana Uptime] ${payload.targetName} is DOWN`;

    const normalizedRecipients = payload.destination
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .join(", ");

    const nodemailerModule = await import("nodemailer");
    const nodemailer = nodemailerModule.default;
    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === "true",
        auth:
            process.env.SMTP_USER && process.env.SMTP_PASS
                ? {
                      user: process.env.SMTP_USER,
                      pass: process.env.SMTP_PASS,
                  }
                : undefined,
    });

    await transporter.sendMail({
        from,
        to: normalizedRecipients,
        subject,
        text: message,
    });

    return {
        sent: true,
    };
}

async function sendEmailAlert(payload: AlertPayload) {
    const message = formatMessage(payload);
    const deliveryResult = await sendEmailViaSmtp(payload, message);

    if (!deliveryResult.sent) {
        console.warn("📭 Email alert not sent", {
            to: payload.destination,
            target: payload.targetName,
            state: payload.isUp ? "UP" : "DOWN",
            reason: deliveryResult.reason,
        });
        return;
    }

    console.log("📧 Email alert sent", {
        to: payload.destination,
        target: payload.targetName,
        state: payload.isUp ? "UP" : "DOWN",
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
