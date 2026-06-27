import type { ProductResponse } from './catalogTypes';

/** Subsequence + substring match for lightweight client-side search. */
function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function searchProducts(products: ProductResponse[], query: string, limit = 40): ProductResponse[] {
  const q = query.trim();
  if (!q) return products.slice(0, limit);
  const scored: { p: ProductResponse; score: number }[] = [];

  for (const p of products) {
    const name = p.name ?? '';
    const sku = p.sku ?? '';
    const brand = p.brand ?? '';
    const barcode = p.barcode ?? '';
    let score = 0;
    if (sku.toLowerCase() === q.toLowerCase()) score = 100;
    else if (barcode === q) score = 95;
    else if (name.toLowerCase().startsWith(q.toLowerCase())) score = 80;
    else if (sku.toLowerCase().startsWith(q.toLowerCase())) score = 75;
    else if (fuzzyMatch(q, name)) score = 60;
    else if (fuzzyMatch(q, sku)) score = 50;
    else if (fuzzyMatch(q, brand)) score = 40;
    else if (fuzzyMatch(q, barcode)) score = 30;
    if (score > 0) scored.push({ p, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.p);
}
