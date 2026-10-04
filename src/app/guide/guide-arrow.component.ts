import { Component } from '@angular/core';

/** The Guide's drawn arrow - a red line and its head - pointing right: one block on to the next
 *  (01), one thing on to what it makes (05's flows). It stretches to the width it's given. */
@Component({
  selector: 'assay-guide-arrow',
  standalone: true,
  host: { 'aria-hidden': 'true' },
  template: `<i></i><b></b>`,
  styles: `
    :host {
      display: flex;
      align-items: center;
    }
    i {
      flex: 1;
      height: 2px;
      background: var(--color-accent);
    }
    b {
      width: 0;
      height: 0;
      border-left: 8px solid var(--color-accent);
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
    }
  `,
})
export class GuideArrowComponent {}
