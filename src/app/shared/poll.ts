import { DestroyRef, inject } from '@angular/core';

/**
 * Starts (idempotently) a fixed-interval poll that keeps re-checking `active()` before every
 * tick and stops itself - clearing its own interval - the moment `active()` reads false. No
 * backoff, no tick limit: nothing in this app has an SLA to tune against, so "poll until there's
 * nothing left to wait for, then stop" is the whole policy. `tick()` is responsible for skipping
 * itself while a previous fetch is still in flight (e.g. checking a `Paged.loading()` signal) -
 * this only decides *whether* to poll at all, not whether a given tick actually fires a request.
 *
 * Must be called from a component's constructor (an active injection context) - it registers its
 * own `DestroyRef.onDestroy()` cleanup so a poll never outlives the page that started it, since
 * nothing else in this app tears anything down and a raw `setInterval` won't stop itself on
 * navigation. Call the returned function from a constructor `effect()` that reads `active()` -
 * see execution.component.ts for the pattern. Calling it again while already polling is a no-op.
 */
export function pollWhile(active: () => boolean, tick: () => void, intervalMs = 15000) {
  let timer: ReturnType<typeof setInterval> | undefined;
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  return () => {
    if (timer != null) return;
    timer = setInterval(() => {
      if (!active()) {
        clearInterval(timer);
        timer = undefined;
      } else {
        tick();
      }
    }, intervalMs);
  };
}
