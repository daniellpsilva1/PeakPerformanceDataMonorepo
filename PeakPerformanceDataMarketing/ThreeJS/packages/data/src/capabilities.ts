import type { BodySystemId } from "@bodyviz/tokens";
import type { Provider } from "@bodyviz/core";

export interface ProviderCapability {
  sleepDuration: boolean;
  sleepStages: boolean;
  recoveryScore: boolean;
  hrv: boolean;
  rhr: boolean;
  trainingLoad: boolean;
  stress: boolean;
  bodyBattery: boolean;
}

export const providerCapabilities: Record<Provider, ProviderCapability> = {
  garmin: {
    sleepDuration: true,
    sleepStages: true,
    recoveryScore: false,
    hrv: true,
    rhr: true,
    trainingLoad: true,
    stress: true,
    bodyBattery: true,
  },
  whoop: {
    sleepDuration: true,
    sleepStages: true,
    recoveryScore: true,
    hrv: true,
    rhr: true,
    trainingLoad: true,
    stress: false,
    bodyBattery: false,
  },
  polar: {
    sleepDuration: true,
    sleepStages: false,
    recoveryScore: false,
    hrv: true,
    rhr: true,
    trainingLoad: true,
    stress: false,
    bodyBattery: false,
  },
  mixed: {
    sleepDuration: true,
    sleepStages: true,
    recoveryScore: true,
    hrv: true,
    rhr: true,
    trainingLoad: true,
    stress: true,
    bodyBattery: true,
  },
  demo: {
    sleepDuration: true,
    sleepStages: true,
    recoveryScore: true,
    hrv: true,
    rhr: true,
    trainingLoad: true,
    stress: true,
    bodyBattery: true,
  },
};

const metricToSystemMap: Record<string, BodySystemId> = {
  sleepDuration: "sleep",
  sleepStages: "sleep",
  recoveryScore: "recovery",
  hrv: "hrv",
  rhr: "rhr",
  trainingLoad: "load",
  stress: "stress",
  bodyBattery: "stress",
};

/**
 * Get the list of available tour stops for a given provider.
 * Uses the provider capability matrix to filter stops.
 */
export function getAvailableStops(provider: Provider): BodySystemId[] {
  const caps = providerCapabilities[provider];
  const available = new Set<BodySystemId>();

  for (const [metric, system] of Object.entries(metricToSystemMap)) {
    const isAvailable = caps[metric as keyof ProviderCapability];
    if (isAvailable) {
      available.add(system);
    }
  }

  return Array.from(available);
}
