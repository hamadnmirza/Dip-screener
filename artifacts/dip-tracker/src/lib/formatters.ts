export function formatCurrency(value: number, currency: string = "USD") {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number) {
  // value is expected to be negative, e.g., -14.7
  const formatted = Math.abs(value).toFixed(2);
  return value < 0 ? `-${formatted}%` : `+${formatted}%`;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
