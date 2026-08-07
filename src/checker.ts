import {Target} from "./types";
import * as net from "node:net";
import { execFile } from "node:child_process";

const CHECK_TIMEOUT_MS = 5000;

function checkPing(host: string, start: number): Promise<{ up: boolean; latency: number | null }> {
    const timeoutSeconds = Math.ceil(CHECK_TIMEOUT_MS / 1000);
    const args = process.platform === "win32"
        ? ["-n", "1", "-w", String(CHECK_TIMEOUT_MS), host]
        : process.platform === "darwin"
            ? ["-n", "-c", "1", "-W", String(CHECK_TIMEOUT_MS), host]
            : ["-n", "-c", "1", "-W", String(timeoutSeconds), host];

    return new Promise((resolve) => {
        execFile("ping", args, { timeout: CHECK_TIMEOUT_MS + 1000 }, (error, stdout) => {
            if (error) {
                resolve({ up: false, latency: null });
                return;
            }

            const match = stdout.match(/time[=<]\s*([\d.]+)\s*ms/i);
            resolve({
                up: true,
                latency: match ? Math.max(1, Math.round(Number(match[1]))) : Date.now() - start,
            });
        });
    });
}

export async function checkTarget(target: Target): Promise<{ up: boolean; latency: number | null }> {
    const start = Date.now();

    if (target.type === "http") {
        if (!target.url) {
            return { up: false, latency: null };
        }

        try {
            const res = await fetch(target.url, { method: "GET" });
            return {
                up: res.ok,
                latency: Date.now() - start,
            };
        } catch {
            return { up: false, latency: null };
        }
    }

    if (target.type === "tcp") {
        if (!target.host || target.port === undefined) {
            console.error("Invalid target: host and port are required");
            return { up: false, latency: null };
        }

        const host = target.host;
        const port = target.port;

        return new Promise((resolve) => {
            const socket = new net.Socket();
            let done = false;

            socket.setTimeout(CHECK_TIMEOUT_MS);

            socket
                .connect(port, host, () => {
                    if (!done) {
                        done = true;
                        socket.destroy();
                        resolve({ up: true, latency: Date.now() - start });
                    }
                })
                .on("error", () => {
                    if (!done) {
                        done = true;
                        resolve({ up: false, latency: null });
                    }
                })
                .on("timeout", () => {
                    if (!done) {
                        done = true;
                        socket.destroy();
                        resolve({ up: false, latency: null });
                    }
                });
        });
    }

    if (target.type === "ping") {
        if (!target.host) {
            console.error("Invalid ping target: host is required");
            return { up: false, latency: null };
        }

        return checkPing(target.host, start);
    }

    return { up: false, latency: null };
}
