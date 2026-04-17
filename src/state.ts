type StatusPoint = {
    time: number;
    up: boolean;
    latency: number | null;
};

type ServiceHistory = {
    name: string;
    group: string;
    points: StatusPoint[];
};

const MAX_POINTS = 50;

let currentStatus: any[] = [];
let historyMap: Record<string, ServiceHistory> = {};

export function setStatus(status: any[]) {
    currentStatus = status;

    for (const item of status) {
        const key = `${item.group}::${item.name}`;

        if (!historyMap[key]) {
            historyMap[key] = {
                name: item.name,
                group: item.group,
                points: [],
            };
        }

        const points = historyMap[key].points;

        points.push({
            time: Date.now(),
            up: item.up,
            latency: item.latency,
        });

        if (points.length > MAX_POINTS) {
            points.shift();
        }
    }
}

export function getStatus() {
    return currentStatus;
}

export function getHistory() {
    return Object.values(historyMap);
}
