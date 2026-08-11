type CurrencyFormatOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatCurrencyAmount(
  value: number | null | undefined,
  currencyCode: string | null | undefined,
  options: CurrencyFormatOptions = {}
): string {
  const numericValue = Number(value ?? 0);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const normalizedCode = currencyCode?.trim().toUpperCase() || 'USD';
  const numberOptions = {
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  };

  if (normalizedCode === 'MIXED') {
    return safeValue.toLocaleString('en-US', numberOptions);
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCode,
      ...numberOptions,
    }).format(safeValue);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      ...numberOptions,
    }).format(safeValue);
  }
}
