const fs = require('fs');
const path = '/Users/roger/Library/Group Containers/group.com.docker/settings.json';
const settings = JSON.parse(fs.readFileSync(path, 'utf8'));
settings['docker-daemon-config'] = JSON.stringify({
  "insecure-registries": ["tnum-services:5000"]
});
fs.writeFileSync(path, JSON.stringify(settings, null, 2));
console.log('Updated settings.json');
