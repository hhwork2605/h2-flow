/**
 * nanoid.ts — short collision-resistant id generator.
 *
 * Layer: Utility
 * Owner: shared
 *
 * Không thêm dep `nanoid` để giữ bundle nhỏ. Dùng `crypto.getRandomValues` +
 * base36 — đủ dài để tránh va chạm trong scope client (~36^8 = 2.8 × 10¹²).
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Sinh id 10 ký tự + prefix tuỳ chọn.
 *   nanoid()        → "k3a9zx18qm"
 *   nanoid('wf')    → "wf_k3a9zx18qm"
 */
export function nanoid(prefix?: string): string {
  const bytes = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return prefix ? `${prefix}_${out}` : out;
}
