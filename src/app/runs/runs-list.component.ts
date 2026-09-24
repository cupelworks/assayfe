import { Component, inject, input, effect, untracked, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RunsApiService } from '../api/runs-api.service';
import { AnyRunMetadata, TestStatus } from '../api/models';
import { rel, short, statusColor } from '../shared/format';
import { Paged } from '../shared/paged';
import { PagerComponent } from '../shared/pager.component';

const ORIGIN_LABEL: Record<string, string> = {
  Standalone: 'Standalone',
  TestSet: 'Test set',
  TestPlan: 'Test plan',
};

/** Every run in the system, optionally restricted to one status (?status=Green, set from the
 *  Overview page's "Run status" tiles) - not filtered client-side, the API does the filtering
 *  (GET /runs?status=...) so total() reflects the true count, not a capped sample. */
@Component({
  selector: 'assay-runs-list',
  standalone: true,
  imports: [RouterLink, PagerComponent],
  templateUrl: './runs-list.component.html',
  styleUrls: ['../shared/page.css'],
})
export class RunsListComponent {
  /** Bound from the ?status= query param via withComponentInputBinding() - undefined shows every run. */
  status = input<TestStatus | undefined>();
  private runsApi = inject(RunsApiService);
  rel = rel;
  short = short;
  statusColor = statusColor;
  originLabel = (o: string) => ORIGIN_LABEL[o] ?? o;
  title = computed(() => (this.status() ? `${this.status()} runs` : 'All runs'));
  page = new Paged<AnyRunMetadata>((o, l) => this.runsApi.latestRunsPage(o, l, this.status()), 25);
  runs = this.page.items;
  constructor() {
    effect(() => {
      this.status();
      // untracked: page.reset() -> reload() reads page's own offset()/limit() signals - see
      // scopes-list.component.ts's identical comment.
      untracked(() => this.page.reset());
    });
  }
}
