import express from "express";
import path from "path";
import { startScheduler } from "./scheduler";
import { getStatus, getHistory } from "./state";
import { watchConfig } from "./config-watcher";
import {
    addConfigSet,
    deleteConfigSet,
    getConfig,
    getConfigBySetId,
    getConfigSets,
    hasConfigSet,
    setConfig,
    setConfigBySetId,
    updateConfigSetName,
} from "./config";

const app = express();
const PORT = process.env.PORT || 3005;

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

app.get("/api/config-sets", (req, res) => {
    res.json(getConfigSets());
});

app.post("/api/config-sets", (req, res) => {
    try {
        const name = typeof req.body?.name === "string" ? req.body.name : "";
        const id = typeof req.body?.id === "string" ? req.body.id : undefined;
        const createdSet = addConfigSet(name, id);
        res.status(201).json(createdSet);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.patch("/api/config-sets/:setId", (req, res) => {
    try {
        const name = typeof req.body?.name === "string" ? req.body.name : "";
        const updatedSet = updateConfigSetName(req.params.setId, name);
        res.json(updatedSet);
    } catch (err: any) {
        const message = String(err?.message || "");
        if (message.includes("Unknown config set")) {
            return res.status(404).json({ error: "Configuration set not found" });
        }
        if (message.includes("required")) {
            return res.status(400).json({ error: "Set name is required" });
        }
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/config-sets/:setId", (req, res) => {
    try {
        deleteConfigSet(req.params.setId);
        res.status(204).send();
    } catch (err: any) {
        const message = String(err?.message || "");
        if (message.includes("Unknown config set")) {
            return res.status(404).json({ error: "Configuration set not found" });
        }
        if (message.includes("At least one configuration set")) {
            return res.status(409).json({ error: "At least one configuration set is required" });
        }
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/config-sets/:setId/status", (req, res) => {
    const { setId } = req.params;
    if (!hasConfigSet(setId)) {
        return res.status(404).json({ error: "Configuration set not found" });
    }
    res.json(getStatus(setId));
});

app.get("/api/config-sets/:setId/history", (req, res) => {
    const { setId } = req.params;
    if (!hasConfigSet(setId)) {
        return res.status(404).json({ error: "Configuration set not found" });
    }
    res.json(getHistory(setId));
});

// GET config
app.get("/api/config", (req, res) => {
    res.json(getConfig());
});

app.get("/api/config-sets/:setId/config", (req, res) => {
    try {
        res.json(getConfigBySetId(req.params.setId));
    } catch {
        res.status(404).json({ error: "Configuration set not found" });
    }
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

        setConfig(newConfig);

        res.json({ success: true });
    } catch (err: any) {
        console.error("SAVE ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/config-sets/:setId/config", (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: "Missing JSON body" });
        }

        const newConfig = req.body;
        if (!newConfig.groups) {
            return res.status(400).json({ error: "Invalid config: missing groups" });
        }

        setConfigBySetId(req.params.setId, newConfig);
        res.json({ success: true });
    } catch (err: any) {
        if (String(err?.message || "").includes("Unknown config set")) {
            return res.status(404).json({ error: "Configuration set not found" });
        }
        res.status(500).json({ error: err.message });
    }
});

// Serve frontend
app.use(express.static(path.join(__dirname, "../web/dist")));
app.get(["/", "/sets/:setId"], (req, res) => {
    res.sendFile(path.join(__dirname, "../web/dist/index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});