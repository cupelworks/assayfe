import { Component, computed, inject, signal } from '@angular/core';
import { HealthApiService } from '../api/health-api.service';
import { WorkerHealth } from '../api/models';
import { counted } from './format';
import { StatusLineComponent, StatusTone } from './status-line.component';

/**
 * Whether runs can start, from the workers alone (GET /health/worker): "Ready to run" in green,
 * with how many workers answered, when they all run the current code; otherwise "Not ready to
 * run" in amber, asking the user to have the admin restart them - no worker answering, one on older
 * code and the queue out of reach all read the same; "Can't tell" in grey when the call fails,
 * never a guess. Read once, when the page opens, as the Settings page reads it (the call takes
 * about a second); nothing shows until it's back.
 */
@Component({
  selector: 'assay-workers-status',
  standalone: true,
  imports: [StatusLineComponent],
  template: `
    @if (view(); as v) {
      <assay-status-line [tone]="v.tone" [title]="v.title" [text]="v.text" />
    }
  `,
})
export class WorkersStatusComponent {
  private health = signal<WorkerHealth | null>(null);
  private failed = signal(false);

  view = computed((): { tone: StatusTone; title: string; text: string } | null => {
    if (this.failed())
      return { tone: 'unknown', title: "Can't tell", text: "Couldn't read the workers" };
    const h = this.health();
    if (!h) return null;
    return h.status === 'ready'
      ? { tone: 'ok', title: 'Ready to run', text: `${counted(h.workers.length, 'worker')} ready` }
      : { tone: 'warn', title: 'Not ready to run', text: 'Ask your admin to restart the workers' };
  });

  constructor() {
    inject(HealthApiService)
      .worker()
      .subscribe({
        next: (h) => this.health.set(h),
        error: () => this.failed.set(true),
      });
  }
}
