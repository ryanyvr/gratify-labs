export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyExact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatBPS(value: number): string {
  return `${value.toFixed(1)} BPS`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatEffRate(rate: number): string {
  return `${(rate * 100).toFixed(3)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function bpsColor(bps: number, target: number = 65): string {
  if (bps <= target) return "text-green-600";
  if (bps <= target * 1.2) return "text-amber-600";
  return "text-red-600";
}

export function bpsBgColor(bps: number, target: number = 65): string {
  if (bps <= target) return "bg-green-100 text-green-800";
  if (bps <= target * 1.2) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}
