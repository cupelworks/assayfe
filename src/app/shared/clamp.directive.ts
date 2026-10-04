import { Directive, ElementRef, OnDestroy, effect, inject, input, signal } from '@angular/core';

/**
 * Whether a folded box actually hides anything. "More ↓" used to appear for any value over a
 * character count, even when it fitted in the folded lines and More did nothing. Put it on the
 * folded element - `[assayClamp]="folded"` (`folded` is whether the fold applies now), read with
 * `#c="clamp"` - and show the toggle while `c.overflows()` or while the box is unfolded (for
 * "Less ↑"). It re-measures when the box resizes (window width, fonts loading).
 */
@Directive({ selector: '[assayClamp]', standalone: true, exportAs: 'clamp' })
export class ClampDirective implements OnDestroy {
  folded = input(false, { alias: 'assayClamp' });
  /** Folded, and its content is taller than what shows. */
  overflows = signal(false);
  private el = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private observer = new ResizeObserver(() => this.measure());

  constructor() {
    this.observer.observe(this.el);
    // The fold switching on or off changes what fits: measure after the class applies.
    effect(() => {
      this.folded();
      queueMicrotask(() => this.measure());
    });
  }
  private measure() {
    this.overflows.set(this.folded() && this.el.scrollHeight > this.el.clientHeight + 1);
  }
  ngOnDestroy() {
    this.observer.disconnect();
  }
}
