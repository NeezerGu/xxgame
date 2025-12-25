import { enUSMessages } from "./messages.en-US";
import { zhCNMessages } from "./messages.zh-CN";
import { LOCALE_STORAGE_KEY } from "../constants/storage";

export type Locale = "zh-CN" | "en-US";
export type MessageKey = keyof typeof zhCNMessages;

const DEFAULT_LOCALE: Locale = "zh-CN";

const MESSAGES: Record<Locale, Record<MessageKey, string>> = {
  "zh-CN": zhCNMessages,
  "en-US": enUSMessages
};

function format(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function getDefaultLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
    if (saved === "zh-CN" || saved === "en-US") {
      return saved;
    }
  } catch {
    // ignore storage failures
  }

  return DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore storage failures
  }
}

export function t(key: MessageKey, params?: Record<string, string | number>, locale: Locale = getDefaultLocale()): string {
  const dictionary = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const template = dictionary[key] ?? key;
  return format(template, params);
}
