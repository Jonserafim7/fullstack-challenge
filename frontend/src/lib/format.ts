const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

// A multiplier value (e.g. 2.47) as it reads on the game UI ("2.47x").
export function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}
