import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HealthApiService } from '../api/health-api.service';
import { WorkerHealth } from '../api/models';
import { counted, errText, rel } from '../shared/format';
import { StatusMarkComponent } from '../shared/status-mark.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { GuideSection } from '../shared/guide/guide-sections';
import { CATALOG, CatalogColumn } from '../shared/catalog';
import { StateBlockComponent } from '../shared/work/state-block.component';
import { WORKER_MARK, WORKER_STATUS, workersToRestart } from './worker-status';

/**
 * The Workers section of the Settings page: the broker and every
 * worker as GET /health/worker reports them - checked when the page opens and on "Check again"
 * (quiet, under the section's title), never polled (the call takes about a second). How they stand
 * as a big word - its mark, what it means and what to do, the facts - then a ruled row per worker:
 * its version, whether it's up to date, the API's `problem` sentence as sent. Fingerprints are the
 * API's to compare; they're never shown.
 */
@Component({
  selector: 'assay-worker-status',
  standalone: true,
  imports: [GuideSectionComponent, StateBlockComponent, StatusMarkComponent, CATALOG],
  templateUrl: './worker-status.component.html',
  styleUrls: ['../shared/work/work.css', './settings-section.css', './worker-status.component.css'],
})
export class WorkerStatusComponent implements OnInit {
  private api = inject(HealthApiService);
  /** Its place on the page: its number and title, its link in the head's index. */
  section = input.required<GuideSection>();
  columns: CatalogColumn[] = [
    { label: 'Worker', width: 3 },
    { label: 'Version', width: 1.2 },
    { label: 'State', width: 2 },
    { label: 'Problem', width: 2.8 },
  ];
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
  mark = computed(() => {
    const h = this.health();
    return h ? WORKER_MARK[h.status] : null;
  });
  /** Under its title: "Read-only · checked just now · API 1.2.0". */
  sub = computed(() => {
    const h = this.health();
    return ['Read-only', h && `checked ${rel(h.checked_at)}`, h?.version && `API ${h.version}`]
      .filter(Boolean)
      .join(' · ');
  });
  /** "Broker reachable · 3 workers · none needs a restart". */
  facts = computed(() => {
    const h = this.health();
    if (!h) return null;
    if (!h.broker.reachable) return 'Broker unreachable';
    const n = this.toRestart().length;
    return [
      'Broker reachable',
      counted(h.workers.length, 'worker'),
      n ? `${n} ${n === 1 ? 'needs' : 'need'} a restart` : 'none needs a restart',
    ].join(' · ');
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
}
