import { Component, computed, signal } from '@angular/core';
import { SettingsSource, TargetSettingsRead, WorkerHealth } from '../api/models';
import { CATALOG, CatalogColumn } from '../shared/catalog';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { GuideSection } from '../shared/guide/guide-sections';
import { OPERATIONS } from './settings-fields';
import { SettingsGroupComponent } from './settings-group.component';
import { JUDGE_GROUP, SettingsGroupConfig, TARGET_GROUP } from './settings-groups';
import { WorkerStatusComponent } from './worker-status.component';
import { WORKER_MARK, WORKER_STATUS, workersToRestart } from './worker-status';

/** /settings - what Assay tests and how it's set up, on the Guide's layout:
 *  the head, with a numbered link per section and what each holds now (in
 *  place of summary tiles - the tile look means "filter" in this app), then the sections. The
 *  editable groups - the application under test and the LLM judge - are the same
 *  SettingsGroupComponent, each with its own config (settings-groups.ts), since every group has
 *  the same endpoints (/settings/<group>) and lifecycle; each reports what it loaded or saved so
 *  the index stays current. The read-only operations are static content from
 *  `settings-fields.ts` - no endpoint exposes that group - and never show a connection string. */
@Component({
  selector: 'assay-settings',
  standalone: true,
  imports: [
    GuideHeadComponent,
    GuideSectionComponent,
    CATALOG,
    SettingsGroupComponent,
    WorkerStatusComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['../shared/guide/guide.css', '../shared/work/work.css', './settings-section.css'],
})
export class SettingsComponent {
  target = TARGET_GROUP;
  judge = JUDGE_GROUP;
  operations = OPERATIONS;
  opColumns: CatalogColumn[] = [
    { label: 'Setting', width: 2.4 },
    { label: 'Value', width: 3 },
    { label: 'What it is', width: 3.6 },
  ];
  saved = {
    target: signal<SettingsSource | null>(null),
    judge: signal<SettingsSource | null>(null),
  };
  workers = signal<WorkerHealth | null>(null);
  /** The application under test's saved URL - the judge group warns when its URL is this one. */
  targetUrl = computed(() => (this.saved.target() as TargetSettingsRead | null)?.url ?? null);

  /** A link per section, each with what it holds now. */
  sections = computed<GuideSection[]>(() => [
    { no: '01', id: 'settings-target', ...this.groupNow(this.target, this.saved.target()) },
    { no: '02', id: 'settings-judge', ...this.groupNow(this.judge, this.saved.judge()) },
    { no: '03', id: 'settings-workers', label: 'Workers', ...this.workersNow(this.workers()) },
    {
      no: '04',
      id: 'settings-operations',
      label: 'Operations',
      value: `${OPERATIONS.length} values`,
      detail: 'Read-only · set when the server starts',
    },
  ]);

  private groupNow(config: SettingsGroupConfig, s: SettingsSource | null) {
    const now = s ? config.summary(s) : { value: '…', detail: 'Loading' };
    const source = s && (s.source === 'database' ? 'saved in Assay' : 'from the environment');
    return {
      label: config.title,
      ...now,
      detail: source ? `${now.detail} · ${source}` : now.detail,
    };
  }

  private workersNow(h: WorkerHealth | null) {
    if (!h) return { value: '…', detail: 'Checking' };
    const n = h.workers.length;
    const restart = workersToRestart(h).length;
    return {
      mark: WORKER_MARK[h.status],
      value: WORKER_STATUS[h.status].label,
      detail: !n
        ? 'No worker connected'
        : restart
          ? `${restart} of ${n} need a restart`
          : `${n} worker${n === 1 ? '' : 's'} on the current code`,
    };
  }
}
