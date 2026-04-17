import {Target} from "./types";
import * as net from "node:net";

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

            socket.setTimeout(5000);

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

    return { up: false, latency: null };
}