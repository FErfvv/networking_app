/**
 * Minimal chainable fake of the supabase-js query builder. Records every
 * call so tests can assert on what would be sent to PostgREST, and resolves
 * with a scripted response per table/rpc.
 */
type Resp = { data?: unknown; error?: { code?: string; message?: string } | null };
export type Call = { table: string; ops: { op: string; args: unknown[] }[] };

export function createFakeSupabase(script: {
  from?: Record<string, Resp | Resp[]>;
  rpc?: Record<string, Resp>;
}) {
  const calls: Call[] = [];
  const rpcCalls: { fn: string; args: unknown }[] = [];
  const counters: Record<string, number> = {};

  function nextResp(table: string): Resp {
    const r = script.from?.[table];
    if (Array.isArray(r)) {
      const i = counters[table] ?? 0;
      counters[table] = i + 1;
      return r[Math.min(i, r.length - 1)];
    }
    return r ?? { data: null, error: null };
  }

  function builder(table: string) {
    const call: Call = { table, ops: [] };
    calls.push(call);
    let resolved: Resp | null = null;
    const resolve = () => (resolved ??= nextResp(table));
    const proxy: Record<string, unknown> = {};
    for (const op of [
      "select", "insert", "update", "delete", "upsert", "eq", "neq", "in", "is", "not",
      "ilike", "lte", "gte", "lt", "gt", "order", "limit", "range",
    ]) {
      proxy[op] = (...args: unknown[]) => {
        call.ops.push({ op, args });
        return proxy;
      };
    }
    proxy.maybeSingle = () => {
      call.ops.push({ op: "maybeSingle", args: [] });
      return Promise.resolve({ data: null, error: null, ...resolve() });
    };
    proxy.single = () => {
      call.ops.push({ op: "single", args: [] });
      return Promise.resolve({ data: null, error: null, ...resolve() });
    };
    proxy.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, ...resolve() }).then(onOk, onErr);
    return proxy;
  }

  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: null, error: null, ...(script.rpc?.[fn] ?? {}) });
    },
  };

  return { client: client as never, calls, rpcCalls };
}

export const USER_A = "11111111-1111-4111-8111-111111111111";
export const USER_B = "22222222-2222-4222-8222-222222222222";
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
