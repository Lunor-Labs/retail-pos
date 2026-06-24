import type { BarcodeVariant } from './BarcodeGenerator';

interface VariantPrintRowProps {
  variant: BarcodeVariant;
  selected: boolean;
  batchId: string;
  onToggle: (selected: boolean) => void;
  onBatch: (batchId: string) => void;
}

/** One selectable row: checkbox + label + (batch picker if >1 batch) + selected-batch stock. */
export function VariantPrintRow({ variant, selected, batchId, onToggle, onBatch }: VariantPrintRowProps) {
  const batches = variant.batches ?? [];
  const activeBatch = batches.find(b => b.id === batchId) ?? batches[0];
  const stock = activeBatch?.currentStock;

  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-slate-200 rounded-lg">
      <input
        type="checkbox"
        checked={selected}
        onChange={e => onToggle(e.target.checked)}
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

      <span className="text-xs font-semibold whitespace-nowrap shrink-0 w-20 text-right">
        {stock !== undefined
          ? <span className={stock > 0 ? 'text-emerald-600' : 'text-rose-500'}>{stock} in stock</span>
          : <span className="text-slate-400">—</span>}
      </span>
    </div>
  );
}
