BEGIN;

CREATE TABLE IF NOT EXISTS config_sets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

DELETE FROM config_sets;

INSERT INTO config_sets (id, name, config_json, updated_at) VALUES ('default', 'Roger', '{"appTitle":"Kukana - Uptime Dashboard","intervalSeconds":10,"groups":[{"name":"Local Network","targets":[{"name":"Eero Router","type":"tcp","host":"192.168.4.1","port":80,"alerts":{"enabled":true}},{"name":"Eero Kitchen","type":"tcp","url":"","host":"192.168.4.41","port":53,"alerts":{"enabled":true}},{"name":"Eero Office","type":"tcp","url":"","host":"192.168.4.43","port":53,"alerts":{"enabled":true}},{"name":"NAS","type":"tcp","host":"192.168.4.50","port":445,"alerts":{"enabled":true}},{"name":"TNum Services","type":"tcp","url":"","host":"192.168.4.52","port":22,"alerts":{"enabled":true}},{"name":"Tnum Storage","type":"tcp","url":"","host":"192.168.4.53","port":22,"alerts":{"enabled":true}},{"name":"Dell Services","type":"tcp","url":"","host":"192.168.4.2","port":22,"alerts":{"enabled":true}}],"alerts":{"channel":"email","destination":"rblum6976@gmail.com"}},{"name":"Public Services","targets":[{"name":"Google","type":"http","url":"https://www.google.com","alerts":{"enabled":true}},{"name":"GitHub","type":"http","url":"https://github.com","alerts":{"enabled":true}}]},{"name":"My Sites","targets":[{"name":"Kauai Oceanfront Property Web Site","type":"http","url":"https://www.kauaioceanfrontproperty.com","alerts":{"enabled":true}},{"name":"Kauai Oceanfront Property Calendar","type":"http","url":"https://calendar.kukana.app","alerts":{"enabled":true}},{"name":"Banzai Soccer","type":"http","url":"https://www.banzai.soccer","alerts":{"enabled":true}},{"name":"Banzai Kauai","type":"http","url":"https://banzai-kauai.com","alerts":{"enabled":true}},{"name":"TNum Server","type":"http","url":"https://tnum.kokeanu.com","alerts":{"enabled":true}}],"alerts":{"channel":"email","destination":"rblum6976@gmail.com"}}]}', 1781901238240);
INSERT INTO config_sets (id, name, config_json, updated_at) VALUES ('test-set-1', 'Test Set 1', '{"appTitle":"Test Set 1 - Uptime Dashboard","intervalSeconds":30,"groups":[{"name":"Servers","alerts":{"channel":"email","destination":"rblum6976@gmail.com"},"targets":[{"name":"CNN","type":"http","url":"https://www.cnn.com","alerts":{"enabled":true}},{"name":"Google","type":"http","url":"https://www.google.com","alerts":{"enabled":true}},{"name":"Failing Dummy","type":"http","url":"https://www.failing-dummy.com","alerts":{"enabled":true}}]}]}', 1781901238240);

COMMIT;