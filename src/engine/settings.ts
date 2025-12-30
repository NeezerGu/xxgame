import type { SettingsState } from "./types";

export function createDefaultSettings(): SettingsState {
  return {
    autoClaimContracts: true,
    autoAcceptMode: "recommended",
    autoAlchemy: false,
    autoForging: true
  };
}

export function mergeSettings(current: SettingsState | undefined, patch: Partial<SettingsState>): SettingsState {
  return {
    ...(current ?? createDefaultSettings()),
    ...patch
  };
}
