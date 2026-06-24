import { buildVariantSpecs, VariantPrintEntry } from '../src/components/barcodePrintSpecs';

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) { console.log(`   actual   ${a}\n   expected ${e}`); failures++; }
}

const variants = [
  { sku: '10000001', label: 'M · Black', price: 1500,
    batches: [
      { id: 'b1', sellingPrice: 1500, supplierName: 'Acme', date: 'Jun 20', encodedCost: 'XY' },
      { id: 'b2', sellingPrice: 1400, supplierName: 'Acme', date: 'Jun 10' },
    ] },
  { sku: '10000002', label: 'L · Black', price: 1450, batches: [] },
  { sku: '10000003', label: 'XL · Red', price: 1600,
    batches: [{ id: 'b3', sellingPrice: 1600, date: 'Jun 18' }] },
];

// Each selected variant prints exactly one spec (copies are set at the printer).
const s1 = new Map<string, VariantPrintEntry>([
  ['10000001', { selected: true, batchId: 'b1' }],
  ['10000002', { selected: false, batchId: '' }],  // skipped
  ['10000003', { selected: true, batchId: 'b3' }],
]);
const r1 = buildVariantSpecs(variants as any, s1, 'Shirt');
eq('one spec per selected variant', r1.length, 2);
eq('first uses chosen batch b1 price + meta', r1[0],
  { value: '10000001', label: 'Shirt — M · Black', price: 1500, metaText: 'Acme · Jun 20 · XY' });
eq('second selected variant single batch b3', r1[1],
  { value: '10000003', label: 'Shirt — XL · Red', price: 1600, metaText: 'Jun 18' });

// Chosen a different batch -> that batch's price/meta.
const s2 = new Map<string, VariantPrintEntry>([['10000001', { selected: true, batchId: 'b2' }]]);
eq('batchId b2 selects 1400 price', buildVariantSpecs(variants as any, s2, 'Shirt')[0],
  { value: '10000001', label: 'Shirt — M · Black', price: 1400, metaText: 'Acme · Jun 10' });

// No batches -> variant-level price fallback, empty meta.
const s3 = new Map<string, VariantPrintEntry>([['10000002', { selected: true, batchId: '' }]]);
eq('no batches uses variant price', buildVariantSpecs(variants as any, s3, 'Shirt')[0],
  { value: '10000002', label: 'Shirt — L · Black', price: 1450, metaText: '' });

// Missing state entry -> not printed.
eq('absent variant prints nothing', buildVariantSpecs(variants as any, new Map(), 'Shirt').length, 0);

if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll barcode-spec tests passed.');
