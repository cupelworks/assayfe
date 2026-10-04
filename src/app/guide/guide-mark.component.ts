import { Component, computed, input } from '@angular/core';
import { StatusMarkComponent } from '../shared/status-mark.component';

/** A status in the Guide's ruled lists (07, 08): its mark as the app draws it, its word, then what
 *  it means - the content: `<assay-guide-mark of="Pending">Created, not yet picked up.`. */
@Component({
  selector: 'assay-guide-mark',
  standalone: true,
  imports: [StatusMarkComponent],
  template: `<assay-mark [of]="of()" size="md" /><b>{{ word() }}</b
    ><span><ng-content /></span>`,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 14px 112px minmax(0, 1fr);
      column-gap: 12px;
      align-items: start;
      padding: 12px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
      font-size: 14px;
      line-height: 1.5;
    }
    assay-mark {
      margin-top: 5px;
    }
    b {
      font-weight: 800;
    }
  `,
})
export class GuideMarkComponent {
  /** The status, as the API and the marks name it ("NotRan"). */
  of = input.required<string>();
  /** Its word, when it isn't the status's own name ("Not Ran"). */
  label = input<string | null>(null);
  word = computed(() => this.label() ?? this.of());
}
