const fs = require('fs');
const os = require('os');
const path = require('path');

const settingsPath = path.join(os.homedir(), '.docker', 'daemon.json');
const settings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  : {};

const registry = 'tnum-services:5000';
const registries = new Set(settings['insecure-registries'] || []);
registries.add(registry);
settings['insecure-registries'] = [...registries];

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
console.log(`Enabled insecure registry ${registry} in ${settingsPath}`);
