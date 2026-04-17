import express from "express";
import fs from "fs";
import path from "path";
import { startScheduler } from "./scheduler";
import { getStatus, getHistory } from "./state";
import { watchConfig } from "./config-watcher";
import { getConfig, setConfig } from "./config";

const app = express();
const PORT = process.env.PORT || 3000;
const configPath = process.env.CONFIG || "./config.json";

// start monitoring loop
startScheduler();

// watch config changes at runtime
watchConfig(() => {
    console.log("🔄 Config updated at runtime");
});

app.use(express.json());

// API
app.get("/api/status", (req, res) => {
    res.json(getStatus());
});

// GET config
app.get("/api/config", (req, res) => {
    res.json(getConfig());
});

// GET history
app.get("/api/history", (req, res) => {
    res.json(getHistory());
});

// SAVE config
app.post("/api/config", (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: "Missing JSON body" });
        }
        const newConfig = req.body;

        if (!newConfig.groups) {
            return res.status(400).json({ error: "Invalid config: missing groups" });
        }

        const fullPath = path.resolve(configPath);
        console.log("Writing config to:", fullPath);

        fs.writeFileSync(fullPath, JSON.stringify(newConfig, null, 2));

        setConfig(newConfig);

        res.json({ success: true });
    } catch (err: any) {
        console.error("SAVE ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});

// Serve frontend
app.use(express.static(path.join(__dirname, "../web")));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});