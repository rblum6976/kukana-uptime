import chokidar from "chokidar";
import { load, setConfig } from "./config";

const configPath = process.env.CONFIG || "./config.json";

export function watchConfig(onChange?: () => void) {
    const watcher = chokidar.watch(configPath, {
        ignoreInitial: true,
    });

    watcher.on("change", () => {
        try {
            const newConfig = load();
            setConfig(newConfig);

            console.log("📄 Config reloaded");

            if (onChange) onChange();
        } catch (err) {
            console.error("❌ Failed to reload config:", err);
        }
    });
}