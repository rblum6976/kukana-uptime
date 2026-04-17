export type Target = {
    name: string;
    type: "http" | "tcp";
    url?: string;
    host?: string;
    port?: number;
};

export type Group = {
    name: string;
    targets: Target[];
};

export interface Config {
    intervalSeconds: number;
    groups: Group[];
}