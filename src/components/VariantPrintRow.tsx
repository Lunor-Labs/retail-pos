import type { BarcodeVariant } from './BarcodeGenerator';

interface VariantPrintRowProps {
  variant: BarcodeVariant;
  copies: number;
  batchId: string;
  onCopies: (copies: number) => void;
  onBatch: (batchId: string) => void;
}

/** Clamp arbitrary input to a non-negative integer (blank/NaN/negative -> 0). */
function clampCopies(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** One selectable row: checkbox + label + (batch picker if >1 batch) + copies stepper. */
export function VariantPrintRow({ variant, copies, batchId, onCopies, onBatch }: VariantPrintRowProps) {
  const batches = variant.batches ?? [];
  const selected = copies > 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-slate-200 rounded-lg">
      <input
        type="checkbox"
        checked={selected}
        onChange={e => onCopies(e.target.checked ? 1 : 0)}
        className="w-4 h-4 rounded shrink-0"
      />
      <span className="text-sm font-medium text-slate-800 flex-1 truncate">{variant.label}</span>

      {batches.length > 1 ? (
        <select
          value={batchId}
          onChange={e => onBatch(e.target.value)}
          className="text-xs border border-slate-300 rounded px-1.5 py-1 bg-white text-slate-700 max-w-[160px]"
        >
          {batches.map(b => (
            <option key={b.id} value={b.id}>
              {[b.date, `LKR ${b.sellingPrice.toFixed(2)}`].filter(Boolean).join(' – ')}
            </option>
          ))}
        </select>
      ) : batches.length === 1 ? (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {[batches[0].date, `LKR ${batches[0].sellingPrice.toFixed(2)}`].filter(Boolean).join(' – ')}
        </span>
      ) : null}

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onCopies(clampCopies(copies - 1))}
          className="w-7 h-7 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
        >–</button>
        <input
          type="number"
          min={0}
          value={copies}
          onChange={e => onCopies(clampCopies(parseInt(e.target.value, 10)))}
          className="w-12 h-7 text-center text-sm border border-slate-300 rounded"
        />
        <button
          type="button"
          onClick={() => onCopies(clampCopies(copies + 1))}
          className="w-7 h-7 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
        >+</button>
      </div>
    </div>
  );
}
