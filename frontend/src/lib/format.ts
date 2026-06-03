const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}
