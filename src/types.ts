export type Target = {
    name: string;
    type: "http" | "tcp";
    url?: string;
    host?: string;
    port?: number;
    alerts?: {
        enabled?: boolean;
    };
};

export type GroupAlertChannel = "email" | "sms";

export type GroupAlerts = {
    channel: GroupAlertChannel;
    destination: string;
    downAfterMinutes?: number;
    downAfterChecks?: number;
    repeatDownEveryMinutes?: number;
};

export type Group = {
    name: string;
    targets: Target[];
    alerts?: GroupAlerts;
};

export interface Config {
    appTitle?: string;
    intervalSeconds: number;
    groups: Group[];
}

export type ConfigSet = {
    id: string;
    name: string;
    config: Config;
};

export type ConfigSetMeta = {
    id: string;
    name: string;
};

export type ConfigStore = {
    sets: ConfigSet[];
};