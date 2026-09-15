import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    // package.json is the canonical app version. VITE_APP_VERSION remains an
    // explicit frontend-only override for exceptional builds.
    const appVersion = env.VITE_APP_VERSION || pkg.version || "unknown";

    return {
        root: "web",
        plugins: [react()],
        define: {
            __APP_VERSION__: JSON.stringify(appVersion),
            "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
        },
        build: {
            outDir: "dist",
            emptyOutDir: true,
        },
        server: {
            host: env.VITE_DEV_HOST || "127.0.0.1",
            port: Number(env.VITE_DEV_PORT || 5175),
            proxy: {
                "/api": {
                    target: env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3005",
                    changeOrigin: true,
                },
            },
        },
    };
});
