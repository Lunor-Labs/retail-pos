/**
 * Numeric SKU scheme.
 *
 * Product base: 6 digits (100000–999999), allocated as max(existing 6-digit
 * numeric SKUs) + 1. Legacy alphanumeric SKUs (e.g. "NIK-SHO-001") are ignored.
 *
 * Variant SKU: base + 2-digit suffix, concatenated with no separator
 * (100042 -> 10004201). Pure digits + even length lets CODE128 use its compact
 * Code C mode, halving the bar count for reliable scanning at 38mm label width.
 *
 * SKUs are always strings — never parseInt for storage/display, or leading
 * zeros are lost.
 */

const SIX_DIGITS = /^\d{6}$/;
const BASE_FLOOR = 100000;

/** Next 6-digit product base SKU. Ignores non 6-digit-numeric entries. */
export function nextProductSku(existingSkus: string[]): string {
  let max = BASE_FLOOR - 1;
  for (const sku of existingSkus) {
    if (SIX_DIGITS.test(sku)) {
      const n = Number(sku);
      if (n > max) max = n;
    }
  }
  return String(max + 1);
}

/** Variant SKU = base + 2-digit (1-based) suffix, e.g. variantSku('100042', 0) -> '10004201'. */
export function variantSku(baseSku: string, index: number): string {
  return `${baseSku}${String(index + 1).padStart(2, '0')}`;
}
