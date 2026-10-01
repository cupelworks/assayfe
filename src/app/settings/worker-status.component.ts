import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { HealthApiService } from '../api/health-api.service';
import { WorkerHealth } from '../api/models';
import { errText } from '../shared/format';
import { RelTimeComponent } from '../shared/rel-time.component';
import { WORKER_STATUS, workersToRestart } from './worker-status';

/**
 * The Workers section of the Settings page: the broker and every worker as GET /health/worker
 * reports them - checked when the page opens and on "Check again", never polled (the call takes
 * about a second). Left: three tiles (broker, workers, how many need a restart) and a row per
 * worker with its version and the API's `problem` sentence as sent. Right: the verdict for
 * `status` and what to do. Fingerprints are the API's to compare; they're never shown.
 */
@Component({
  selector: 'assay-worker-status',
  standalone: true,
  imports: [RelTimeComponent],
  templateUrl: './worker-status.component.html',
  styleUrls: ['../shared/page.css', './settings-section.css', './worker-status.component.css'],
})
export class WorkerStatusComponent implements OnInit {
  private api = inject(HealthApiService);
  /** Every result, so the page's summary strip can show the verdict too. */
  loaded = output<WorkerHealth>();

  health = signal<WorkerHealth | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  view = computed(() => {
    const h = this.health();
    return h ? WORKER_STATUS[h.status] : null;
  });
  toRestart = computed(() => {
    const h = this.health();
    return h ? workersToRestart(h) : [];
  });

  ngOnInit() {
    this.check();
  }

  check() {
    this.loading.set(true);
    this.api.worker().subscribe({
      next: (h) => {
        this.loading.set(false);
        this.error.set(null);
        this.health.set(h);
        this.loaded.emit(h);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(errText(e));
      },
    });
  }

  readonly green = 'var(--color-status-green)';
  readonly amber = 'var(--color-status-amber)';
  readonly red = 'var(--color-accent)';
  readonly neutral = 'var(--color-neutral-400)';
}
