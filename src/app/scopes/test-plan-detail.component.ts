import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { TestPlansApiService } from '../api/test-plans-api.service';
import { LatestByRow } from '../api/latest';
import { TestPlanEntry } from '../api/models';
import { Paged } from '../shared/paged';
import { counted, errText } from '../shared/format';
import { PagerComponent } from '../shared/pager.component';
import { ArrowOutComponent } from '../shared/arrow-out.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { QuietAction, QuietActionsComponent } from '../shared/work/quiet-actions.component';
import { BannerComponent } from '../shared/work/banner.component';
import { LatestStatusComponent } from '../shared/work/latest-status.component';
import { inWords } from '../shared/work/sentences';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PickDialogComponent, PickRow } from '../shared/dialog/pick-dialog.component';
import { VerdictsTableComponent } from '../statistics/verdicts-table.component';
import { LatestVerdictComponent } from '../statistics/latest-verdict.component';
import { ExecutionsTableComponent } from './executions-table.component';
import { LatestRunComponent } from './latest-run.component';
import { ScopePage, scopeSections } from './scope-page';

type Dlg = 'rename' | 'delete' | 'link' | 'unlink';

/**
 * A test plan's page, on the Guide's layout - as a set's: its top (Run live, Run with statistics ↗,
 * Link test sets · Rename · Delete - Delete pale once it has run), its latest verdict and latest
 * run, then 01 the sets it links - each with its tests and its own latest run, and Remove - 02 its
 * batches, 03 its runs.
 */
@Component({
  selector: 'assay-test-plan-detail',
  standalone: true,
  imports: [
    RouterLink,
    ArrowOutComponent,
    GuideHeadComponent,
    GuideSectionComponent,
    CATALOG,
    QuietActionsComponent,
    BannerComponent,
    LatestStatusComponent,
    PagerComponent,
    NameDialogComponent,
    ConfirmDialogComponent,
    PickDialogComponent,
    VerdictsTableComponent,
    LatestVerdictComponent,
    ExecutionsTableComponent,
    LatestRunComponent,
  ],
  templateUrl: './test-plan-detail.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
  ],
})
export class TestPlanDetailComponent extends ScopePage<Dlg> {
  readonly kind = 'test-plans' as const;
  readonly one = 'test plan';
  private plansApi = inject(TestPlansApiService);
  sections = scopeSections('Test sets');
  counted = counted;

  page = new Paged<TestPlanEntry>(
    (o, l) => this.plansApi.testPlanEntries(this.id(), o, l),
    25,
    errText,
  );
  /** Every run of it, a statistics batch's included - one is enough to keep it from being
   *  deleted. */
  allRuns = signal<number | null>(null);
  hasRuns = computed(() => !!this.allRuns());
  setRuns = new LatestByRow(
    () => 'test-sets',
    () => this.page.items().map((l) => l.test_set.id),
    { runs: true },
  );
  unlinkTarget = signal<TestPlanEntry | null>(null);

  lede = computed(() => {
    const sets = this.page.total();
    if (!sets) return 'No test sets linked yet: link some, then run it.';
    const tests = this.page.items().reduce((n, l) => n + (l.test_set.entry_count ?? 0), 0);
    const known = this.page.items().length === sets;
    const what = sets === 1 ? 'Runs one test set' : `Runs ${inWords(sets)} test sets together`;
    return (
      `${what}${known ? `, ${counted(tests, 'test')} in all` : ''}. ` +
      'It links the sets themselves, so each run takes their tests as they are then.'
    );
  });
  canRun = computed(() => this.page.total() > 0);
  quiet = computed<QuietAction[]>(() => [
    { key: 'link', label: 'Link test sets' },
    { key: 'rename', label: 'Rename' },
    { key: 'delete', label: 'Delete', disabled: this.hasRuns() },
  ]);
  why = computed(
    () =>
      [
        this.meta() && !this.page.loading() && !this.canRun()
          ? 'It needs a test set before it can run.'
          : '',
        this.hasRuns() ? "It can't be deleted once it has run." : '',
      ]
        .filter(Boolean)
        .join(' ') || null,
  );

  columns: CatalogColumn[] = [
    { label: 'Test set', width: 3.4 },
    { label: 'Tests', width: 1 },
    { label: 'Its latest run', width: 3 },
    idColumn('Entry ID'),
    { label: '', width: 1 },
  ];
  linksEmpty = computed(() =>
    this.page.loading() || this.page.items().length
      ? null
      : 'No test sets linked - Link test sets adds them. Run live needs at least one.',
  );
  /** Sets to link: one it links already can't be linked again (the API's rule). */
  setRows = computed<PickRow[]>(() => {
    const linked = new Set(this.page.items().map((l) => l.test_set.id));
    return this.store.sets().map((s) => ({
      id: s.id,
      name: s.name,
      sub: counted(s.entry_count ?? 0, 'test'),
      meta: linked.has(s.id) ? 'Linked' : '',
      disabled: linked.has(s.id),
    }));
  });
  linkLabel = (n: number) => (n ? `Link ${counted(n, 'test set')}` : 'Link test sets');

  constructor() {
    super();
    this.store.loadSets();
  }

  reload() {
    this.page.reload();
    this.runsApi
      .executionsPage('test-plans', this.id(), 0, 0)
      .pipe(
        map((p) => p.total),
        catchError(() => of(null)),
      )
      .subscribe((n) => this.allRuns.set(n));
  }
  protected fetchMeta() {
    return this.plansApi.testPlan(this.id());
  }
  protected renamed(name: string) {
    return this.plansApi.renameTestPlan(this.id(), name);
  }
  protected deleted() {
    return this.plansApi.deleteTestPlan(this.id());
  }

  quietAct(key: string) {
    if (key === 'link' || key === 'rename' || key === 'delete') this.open(key);
  }
  askRemove(l: TestPlanEntry) {
    this.unlinkTarget.set(l);
    this.open('unlink');
  }
  removeBody(l: TestPlanEntry) {
    return `Only the link goes. The set, its ${counted(l.test_set.entry_count ?? 0, 'test')} and the plan's past runs stay. Link it again any time.`;
  }
  link(ids: string[]) {
    this.act.run(this.plansApi.linkSetsToPlan(this.id(), ids), {
      ok: () => `Linked ${counted(ids.length, 'test set')}.`,
    });
  }
  unlink() {
    const s = this.unlinkTarget()!.test_set;
    this.act.run(this.plansApi.unlinkSetsFromPlan(this.id(), [s.id]), {
      ok: () => `Removed “${s.name}” from the plan - the set stays.`,
    });
  }
}
