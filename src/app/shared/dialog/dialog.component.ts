import { Component, computed, input, output } from '@angular/core';
/** Modernist .dialog over .dialog-backdrop; body projected; footer = primary + Cancel - and, while
 *  the primary is blocked, why, right beside it: in a long form the reason used to sit at the end
 *  of the body, scrolled out of view, leaving only a pale disabled button. */
@Component({
  selector: 'assay-dialog',
  standalone: true,
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
})
export class DialogComponent {
  kicker = input('');
  title = input.required<string>();
  wide = input(false);
  primaryLabel = input('Save');
  primaryDisabled = input(false);
  danger = input(false);
  /** The primary as a secondary button: when the body offers a better first step of its own. */
  quiet = input(false);
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
}
