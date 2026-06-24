import { nextProductSku, variantSku } from '../src/utils/skuUtils';

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label} -> ${JSON.stringify(actual)}`);
  if (!ok) { console.log(`   expected ${JSON.stringify(expected)}`); failures++; }
}

// nextProductSku
eq('empty list starts at 100000', nextProductSku([]), '100000');
eq('ignores non-numeric legacy SKUs', nextProductSku(['NIK-SHO-001', 'ABCDEF']), '100000');
eq('ignores wrong-length numeric', nextProductSku(['12345', '1234567']), '100000');
eq('increments max 6-digit', nextProductSku(['100000', '100042', 'NIK-001']), '100043');
eq('single existing base', nextProductSku(['100042']), '100043');
eq('numeric (not lexical) max', nextProductSku(['100009', '100010']), '100011');

// variantSku
eq('first variant suffix 01', variantSku('100042', 0), '10004201');
eq('second variant suffix 02', variantSku('100042', 1), '10004202');
eq('tenth variant suffix 10', variantSku('100042', 9), '10004210');

if (failures > 0) { console.error(`\n${failures} test(s) failed`); process.exit(1); }
console.log('\nAll SKU util tests passed.');
