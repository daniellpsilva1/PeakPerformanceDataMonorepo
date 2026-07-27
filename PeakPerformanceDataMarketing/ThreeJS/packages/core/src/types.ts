export type Provider = "garmin" | "whoop" | "polar" | "mixed" | "demo";

export type HrvStatus = "balanced" | "low" | "high" | "unknown";

export interface DailySnapshot {
  date: string;
  provider: Provider;
  sleep: {
    score: number | null;
    durationHours: number | null;
    deepPct: number | null;
    remPct: number | null;
    efficiency: number | null;
  };
  recovery: {
    score: number | null;
    readiness: number | null;
  };
  hrv: {
    rmssdMs: number | null;
    status: HrvStatus;
  };
  rhr: {
    bpm: number | null;
  };
  load: {
    trainingLoad: number | null;
    strainProxy: number | null;
  };
  stress: {
    avg: number | null;
  };
  bodyBattery: {
    high: number | null;
    low: number | null;
    current: number | null;
  };
}

export interface AthleteProfile {
  id: string;
  firstName: string;
  provider: Provider;
  isDemo: boolean;
}
