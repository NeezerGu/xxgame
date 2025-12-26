import packageJson from "../../package.json";
import type { Locale } from "../i18n";

export const APP_NAME = packageJson.name ?? "idle-proto";
export const APP_VERSION = packageJson.version ?? "0.0.0";

export type DiagnosticsInput = {
  locale: Locale;
  tab?: string | null;
  save?: string | null;
  errorMessage?: string | null;
};

export function buildDiagnosticsPayload(input: DiagnosticsInput): string {
  const payload = {
    app: { name: APP_NAME, version: APP_VERSION },
    time: new Date().toISOString(),
    locale: input.locale,
    tab: input.tab ?? "unknown",
    save: input.save ?? null,
    error: input.errorMessage ?? null
  };

  return JSON.stringify(payload, null, 2);
}
