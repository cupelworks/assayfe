import { DestroyRef, effect, inject } from '@angular/core';

/**
 * Polls at a fixed interval (every 2 seconds by default) for as long as `active()` reads true.
 * Registers its own `effect()` on `active` - whenever it turns true the interval starts
 * (idempotently), and every tick
 * re-checks it, clearing the interval the moment it reads false. No backoff, no tick limit:
 * nothing in this app has an SLA to tune against, so "poll until there's nothing left to wait
 * for, then stop" is the whole policy. `tick()` is responsible for skipping itself while a
 * previous fetch is still in flight (e.g. checking a `Paged.loading()` signal) - this only
 * decides *whether* to poll at all, not whether a given tick actually fires a request.
 *
 * Call it once from a component's constructor (an active injection context, which both the
 * `effect()` and the `DestroyRef.onDestroy()` cleanup need) - a poll never outlives the page that
 * started it, since nothing else in this app tears anything down and a raw `setInterval` won't
 * stop itself on navigation. One call replaces what used to be three copy-pasted parts per page
 * (a `startPolling` field, the effect that called it, and the stop check) - see `docs/improvement_ui/dev_notes.md` note 3.
 */
export function pollWhile(active: () => boolean, tick: () => void, intervalMs = 2000): void {
  let timer: ReturnType<typeof setInterval> | undefined;
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  const start = () => {
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
  effect(() => {
    if (active()) start();
  });
}

/**
 * Calls `reload` each time the page's browser tab comes back into view: "Run with statistics ↗" and
 * "Run again ↗" open their own tab, and what was started there should show here on coming back.
 * Call it once from a component's constructor, as `pollWhile`: it stops listening with the page.
 */
export function whenTabShown(reload: () => void): void {
  const onShow = () => {
    if (document.visibilityState === 'visible') reload();
  };
  document.addEventListener('visibilitychange', onShow);
  inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onShow));
}
