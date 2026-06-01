// Pure encode/decode helpers — no React, no side effects.
// key: 10 unique uppercase letters, position = digit (key[0]=0, key[1]=1, …)
// Example key "BLACKSTONE": B=0, L=1, A=2, C=3, K=4, S=5, T=6, O=7, N=8, E=9

export function encodeCost(amount: number, key: string): string {
  if (!isValidKey(key)) return Math.round(amount).toString();
  const k = key.toUpperCase();
  return Math.round(amount)
    .toString()
    .split('')
    .map(d => k[parseInt(d)])
    .join('');
}

export function decodeCost(code: string, key: string): number {
  if (!isValidKey(key)) return parseFloat(code) || 0;
  const k = key.toUpperCase();
  const upper = code.toUpperCase().trim();
  if (!upper) return 0;
  const digits = upper.split('').map(c => {
    const idx = k.indexOf(c);
    return idx === -1 ? null : idx.toString();
  });
  if (digits.some(d => d === null)) return NaN;
  return parseInt(digits.join(''));
}

export function isValidCostCode(code: string, key: string): boolean {
  if (!isValidKey(key)) return !isNaN(parseFloat(code));
  const k = key.toUpperCase();
  return code.toUpperCase().trim().split('').every(c => k.includes(c));
}

export function isValidKey(key: string): boolean {
  if (!key || key.length !== 10) return false;
  const u = key.toUpperCase();
  return /^[A-Z]{10}$/.test(u) && new Set(u).size === 10;
}
