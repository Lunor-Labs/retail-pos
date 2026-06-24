// Type-only import: erased at compile time, so this module never pulls in
// BarcodeGenerator.tsx (and its jsbarcode/DOM deps) at runtime — that keeps the
// standalone tsx test runnable under plain Node.
import type { BarcodeVariant } from './BarcodeGenerator';

/** One printable sticker: barcode value + label + optional price/meta line. */
export interface StickerSpec {
  value: string;        // barcode value (SKU)
  label: string;        // product name line
  price?: number;
  metaText?: string;    // "supplier · date · cost"
}

/** Join the non-empty parts of a sticker's meta line with " · ". */
export const metaLine = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');

/** Per-variant print selection: whether to print it, and which batch's price to use. */
export interface VariantPrintEntry {
  selected: boolean;
  batchId: string;
}

/**
 * Map a per-variant selection to a flat list of sticker specs — one spec per
 * selected variant (the number of copies is set later in the printer dialog).
 * The chosen batch (by id) sets price/date/cost; with no batch the variant-level
 * price is used.
 */
export function buildVariantSpecs(
  variants: BarcodeVariant[],
  state: Map<string, VariantPrintEntry>,
  productName: string,
): StickerSpec[] {
  const specs: StickerSpec[] = [];
  for (const v of variants) {
    const entry = state.get(v.sku);
    if (!entry?.selected) continue;
    const batch = (v.batches ?? []).find(b => b.id === entry.batchId);
    const spec: StickerSpec = batch
      ? { value: v.sku, label: `${productName} — ${v.label}`, price: batch.sellingPrice, metaText: metaLine(batch.supplierName, batch.date, batch.encodedCost) }
      : { value: v.sku, label: `${productName} — ${v.label}`, price: v.price, metaText: metaLine(v.supplierName, v.date, v.encodedCost) };
    specs.push(spec);
  }
  return specs;
}
