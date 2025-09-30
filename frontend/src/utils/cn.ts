// src/utils/cn.ts

type ClassPrimitive = string | number | null | undefined | false;
type ClassDictionary = Record<string, boolean | null | undefined>;
type ClassArray = ClassValue[];
type ClassValue = ClassPrimitive | ClassDictionary | ClassArray;

/**
 * Robust className joiner (like clsx) without external deps.
 * Supports:
 *  - strings / numbers
 *  - arrays (recursively)
 *  - objects { className: boolean }
 */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  const push = (v: ClassValue): void => {
    if (!v && v !== 0) return; // ignore null/undefined/false
    if (typeof v === 'string' || typeof v === 'number') {
      const s = String(v).trim();
      if (s) out.push(s);
      return;
    }
    if (Array.isArray(v)) {
      for (const x of v) push(x);
      return;
    }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (val) out.push(k.trim());
      }
      return;
    }
  };

  for (const i of inputs) push(i);

  // collapse excess whitespace and duplicates while preserving order
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const token of out.join(' ').split(/\s+/)) {
    if (!token) continue;
    if (!seen.has(token)) {
      seen.add(token);
      deduped.push(token);
    }
  }
  return deduped.join(' ');
}

export default cn;
