import { Component, OnDestroy, OnInit, computed, input, output } from '@angular/core';

/** Dialogs open now - several can stack (a check's settings over the test form). */
let open = 0;
/** A dialog, square and flat on a veil of ink: where it is in the red kicker, what it does as the
 *  title, the body projected, then the footer - the one thing to do in red, Cancel in words and,
 *  while the primary is blocked, why, right beside them (in a long form the reason used to sit at
 *  the end of the body, scrolled out of view, leaving only a pale disabled button). The Esc key
 *  closes it as Cancel does. Ruled in ink on top - in red (`danger`) when what it does can't be
 *  undone. */
@Component({
  selector: 'assay-dialog',
  standalone: true,
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
})
export class DialogComponent implements OnInit, OnDestroy {
  kicker = input('');
  title = input.required<string>();
  wide = input(false);
  primaryLabel = input('Save');
  primaryDisabled = input(false);
  danger = input(false);
  error = input<string | null>(null);
  /** What keeps the primary disabled, one short phrase each ("Required substring (Contains 2)");
   *  shown in the footer as "2 things to fix: … · …". */
  blockers = input<readonly string[]>([]);
  blockersText = computed(() =>
    this.blockers()
      .map((b) => b.charAt(0).toUpperCase() + b.slice(1))
      .join(' · '),
  );
  primary = output<void>();
  close = output<void>();

  /** The page behind stays where it is while a dialog is open: a wheel over the veil, the head or
   *  the foot would otherwise scroll it (the body's own scrolling stops at its ends - its CSS). */
  ngOnInit() {
    if (open++ === 0) document.documentElement.style.overflow = 'hidden';
  }
  ngOnDestroy() {
    if (--open === 0) document.documentElement.style.overflow = '';
  }
  /** A wheel or a swipe on the veil, the head or the foot would scroll the page behind: it's
   *  stopped there. Inside what scrolls (the body, the blockers) it scrolls that, up to its ends. */
  stopOutside(e: Event) {
    const t = e.target as HTMLElement | null;
    if (!t?.closest('.body, .blockers')) e.preventDefault();
  }
}
