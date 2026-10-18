import { Component, input, output } from '@angular/core';

/** A step to take before the batch, in Run with statistics - one run when nothing can vary, or a
 *  trial when there's no history yet: what it is, its cost when it has one (`facts`), what comes
 *  of it (the content, a sentence), and its red button. */
@Component({
  selector: 'assay-first-step',
  standalone: true,
  template: `
    <h3>{{ title() }}</h3>
    @if (facts()) {
      <p class="facts">{{ facts() }}</p>
    }
    <p><ng-content /></p>
    <button type="button" class="btn btn-primary btn-tall" [disabled]="busy()" (click)="act.emit()">
      {{ action() }}
    </button>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      max-width: 760px;
    }
    h3 {
      margin: 0;
      font-size: 21px;
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.3;
    }
    p {
      margin: 0;
      font-size: 15px;
      line-height: 1.55;
      color: var(--color-neutral-900);
      text-wrap: pretty;
    }
    .facts {
      font-size: 13px;
      color: var(--color-neutral-600);
    }
    /* The page's big button (the global .btn-tall), a little apart. */
    .btn {
      margin-top: 10px;
    }
  `,
})
export class FirstStepComponent {
  title = input.required<string>();
  /** What it takes: "10 runs · 10 application calls · no judge calls". */
  facts = input<string | null>(null);
  /** Its button: "Run it once instead". */
  action = input.required<string>();
  /** Starting: its button waits. */
  busy = input(false);
  act = output<void>();
}
