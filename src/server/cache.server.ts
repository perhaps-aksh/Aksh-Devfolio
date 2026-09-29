/**
 * Tiny in-memory TTL cache (per server instance / Worker isolate).
 * Public pages read the same handful of rows again and again, so a short TTL removes almost every
 * database round trip. Only resolved values are stored (never in-flight promises), and a stale
 * value is served if the database is briefly unavailable.
 */
type Entry = { exp: number; value: unknown };

const MAX_ENTRIES = 300;
const store = new Map<string, Entry>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.value as T;
  try {
    const value = await load();
    if (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.delete(key);
    store.set(key, { exp: Date.now() + ttlMs, value });
    return value;
  } catch (error) {
    if (hit) return hit.value as T;
    throw error;
  }
}

/** Called after admin writes so this instance shows changes immediately (other instances catch up within the TTL). */
export function invalidateContent(): void {
  store.clear();
}
