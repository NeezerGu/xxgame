import type { zhCNMessages } from "./messages.zh-CN";

type MessageKey = keyof typeof zhCNMessages;

export const enUSMessages: Record<MessageKey, string> = {
  "app.title": "Arcane Workshop Prototype",
  "app.subtitle": "Deterministic idle prototype scaffold.",
  "app.localeSwitch": "Language",

  "stats.essence": "Essence",
  "stats.insight": "Insight",
  "stats.essencePerSecond": "Essence/sec",

  "ascension.title": "Ascension Progress",
  "ascension.description": "Reach {threshold} Essence to ascend. Progress: {progress}%",
  "ascension.button": "Ascend",

  "actions.title": "Actions",
  "actions.focus": "Focus",
  "actions.focusWithCooldown": "Focus (cooldown {seconds}s)",
  "actions.focusTooltip": "Gain a burst of Essence",
  "actions.fastForward10": "Fast-forward 10s",
  "actions.fastForward60": "Fast-forward 60s",

  "upgrades.title": "Upgrades",
  "upgrades.owned": "Owned: {count}",
  "upgrades.cost": "Cost: {cost}",
  "upgrades.buy": "Buy",

  "dev.title": "Dev Panel",
  "dev.autosave": "Autosaves every 5s.",
  "dev.autosaveWithLast": "Autosaves every 5s • Last saved {time}.",
  "dev.saveNow": "Save Now",
  "dev.loadExport": "Load Export",
  "dev.exportImportLabel": "Export / Import Save JSON",
  "dev.textareaPlaceholder": "Paste save JSON here",
  "dev.exportToTextarea": "Export to textarea",
  "dev.import": "Import",
  "dev.importError": "Import error: {message}",
  "dev.importErrorInvalid": "Invalid save data",
  "dev.importErrorSchemaMismatch": "Save schemaVersion mismatch",

  "locale.zh-CN": "简体中文",
  "locale.en-US": "English",

  "upgrade.spark.name": "Spark Generator",
  "upgrade.spark.description": "+0.5 Essence per second",
  "upgrade.amplify.name": "Essence Amplifier",
  "upgrade.amplify.description": "Multiply Essence production by 1.5"
};
