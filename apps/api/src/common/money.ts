export function centsToCurrency(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

export function platformFeeCents(subtotalCents: number) {
  return Math.round(subtotalCents * 0.06);
}
