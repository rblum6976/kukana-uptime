import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");

    return {
        root: "web",
        plugins: [react()],
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