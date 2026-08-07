import { getConfigBySetId, getConfigSets, load } from "./config";

const dbPath = process.env.DB_PATH || "./data/uptime.db";

function getConfigSnapshot() {
    return JSON.stringify(
        getConfigSets().map((set) => ({
            ...set,
            config: getConfigBySetId(set.id),
        })),
    );
}

export async function watchConfig(onChange?: () => void) {
    const { default: chokidar } = await import("chokidar");
    let configSnapshot = getConfigSnapshot();
    const watcher = chokidar.watch(dbPath, {
        ignoreInitial: true,
    });

    watcher.on("change", () => {
        try {
            load();
            const nextConfigSnapshot = getConfigSnapshot();
            if (nextConfigSnapshot === configSnapshot) {
                return;
            }
            configSnapshot = nextConfigSnapshot;

            console.log("📄 Config reloaded");

            if (onChange) onChange();
        } catch (err) {
            console.error("❌ Failed to reload config:", err);
        }
    });
}
