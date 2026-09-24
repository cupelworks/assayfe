import { Component, inject, input, effect, untracked, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RunsApiService } from '../api/runs-api.service';
import { AnyRunMetadata, RunOrigin, TestStatus } from '../api/models';
import { rel, short, statusColor } from '../shared/format';
import { Paged } from '../shared/paged';
import { PagerComponent } from '../shared/pager.component';

const ORIGIN_LABEL: Record<string, string> = {
  Standalone: 'Standalone',
  TestSet: 'Test set',
  TestPlan: 'Test plan',
};
export const ORIGINS: RunOrigin[] = ['Standalone', 'TestSet', 'TestPlan'];

/** Every run in the system, optionally restricted to one status (?status=Green, set from the
 *  Overview page's "Run status" tiles) and/or one origin (?origin=TestSet, set from the chips
 *  on this page) - not filtered client-side, the API does the filtering
 *  (GET /runs?status=...&origin=...) so total() reflects the true count, not a capped sample. */
@Component({
  selector: 'assay-runs-list',
  standalone: true,
  imports: [RouterLink, PagerComponent],
  templateUrl: './runs-list.component.html',
  styleUrls: ['../shared/page.css', './runs-list.component.css'],
})
export class RunsListComponent {
  /** Bound from the ?status=/?origin= query params via withComponentInputBinding() - undefined shows every run/origin. */
  status = input<TestStatus | undefined>();
  origin = input<RunOrigin | undefined>();
  private runsApi = inject(RunsApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  rel = rel;
  short = short;
  statusColor = statusColor;
  origins = ORIGINS;
  originLabel = (o: string) => ORIGIN_LABEL[o] ?? o;
  title = computed(() => {
    const bits = [this.status() ?? '', this.origin() ? this.originLabel(this.origin()!) : ''];
    const label = bits.filter(Boolean).join(' ');
    return label ? `${label} runs` : 'All runs';
  });
  page = new Paged<AnyRunMetadata>(
    (o, l) => this.runsApi.latestRunsPage(o, l, this.status(), this.origin()),
    25,
  );
  runs = this.page.items;
  constructor() {
    effect(() => {
      this.status();
      this.origin();
      // untracked: page.reset() -> reload() reads page's own offset()/limit() signals - see
      // scopes-list.component.ts's identical comment.
      untracked(() => this.page.reset());
    });
  }
  /** Toggles the ?origin= query param in place - clicking the active chip clears it back to "every origin". */
  toggleOrigin(o: RunOrigin) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { origin: this.origin() === o ? null : o },
      queryParamsHandling: 'merge',
    });
  }
}
