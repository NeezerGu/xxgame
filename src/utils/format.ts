const UNITS = [
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" }
] as const;

function getDecimalPlaces(value: number): number {
  if (value < 10) return 2;
  if (value < 100) return 1;
  return 0;
}

function trimTrailingZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}

export function formatCompact(value: number, options?: { maxDecimals?: number }): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  const abs = Math.abs(value);
  const unit = UNITS.find((item) => abs >= item.value);

  const scaled = unit ? value / unit.value : value;
  const decimalPlaces = getDecimalPlaces(Math.abs(scaled));
  const decimals =
    options?.maxDecimals === undefined ? decimalPlaces : Math.min(decimalPlaces, options.maxDecimals);
  const fixed = scaled.toFixed(decimals);
  const formatted = trimTrailingZeros(fixed);

  return unit ? `${formatted}${unit.suffix}` : formatted;
}

export function formatInt(value: number, locale?: string): string {
  const floored = Math.floor(value);
  return floored.toLocaleString(locale ?? "zh-CN");
}

export function formatSeconds(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${rounded}s`;
}
