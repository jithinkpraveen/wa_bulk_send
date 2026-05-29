// Runs a promise as a background task that outlives the HTTP response, so a
// handler can return immediately while heavy work (marking contacts, sending a
// batch, invoking the next worker) continues. This is the supported way to do
// fire-and-forget work on Supabase Edge Functions — without it, the runtime can
// cancel pending work as soon as the Response is returned.
export function runInBackground(promise: Promise<unknown>) {
    // deno-lint-ignore no-explicit-any
    const edgeRuntime = (globalThis as any).EdgeRuntime
    if (edgeRuntime && typeof edgeRuntime.waitUntil === 'function') {
        edgeRuntime.waitUntil(promise)
    } else {
        // Fallback (e.g. unexpected runtime): at least surface failures.
        console.warn('EdgeRuntime.waitUntil unavailable; running task without keep-alive')
        promise.catch((e) => console.error('background task failed', e))
    }
}
