import { Component, computed, signal } from '@angular/core';
import { SettingsSource, TargetSettingsRead, WorkerHealth } from '../api/models';
import { OPERATIONS } from './settings-fields';
import { SettingsGroupComponent } from './settings-group.component';
import { JUDGE_GROUP, SettingsGroupConfig, TARGET_GROUP } from './settings-groups';
import { WorkerStatusComponent } from './worker-status.component';
import { WORKER_STATUS, workersToRestart } from './worker-status';

interface Tile {
  id: string;
  label: string;
  value: string;
  detail: string;
  mono?: boolean;
  /** A status dot before the label (the workers' verdict). */
  dot?: string;
  go: string;
}

/** /settings - what Assay tests and how it's set up, laid out like Overview: a strip of summary
 *  tiles, then each section on the same thirds. The editable groups - the application under test
 *  and the LLM judge - are the same SettingsGroupComponent, each with its own config
 *  (settings-groups.ts), since every group has the same endpoints (/settings/<group>) and
 *  lifecycle; each reports what it loaded or saved so the strip stays current. The read-only
 *  operations tiles are static content from `settings-fields.ts` - no endpoint exposes that
 *  group - and never show a connection string. */
@Component({
  selector: 'assay-settings',
  standalone: true,
  imports: [SettingsGroupComponent, WorkerStatusComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['../shared/page.css', './settings-section.css', './settings.component.css'],
})
export class SettingsComponent {
  target = TARGET_GROUP;
  judge = JUDGE_GROUP;
  operations = OPERATIONS;
  saved = {
    target: signal<SettingsSource | null>(null),
    judge: signal<SettingsSource | null>(null),
  };
  workers = signal<WorkerHealth | null>(null);
  /** The application under test's saved URL - the judge group warns when its URL is this one. */
  targetUrl = computed(() => (this.saved.target() as TargetSettingsRead | null)?.url ?? null);

  tiles = computed<Tile[]>(() => [
    this.groupTile(this.target, this.saved.target()),
    this.groupTile(this.judge, this.saved.judge()),
    this.workersTile(this.workers()),
    {
      id: 'operations',
      label: 'Operations',
      value: `${OPERATIONS.length} values`,
      detail: 'Read-only · set when the server starts',
      go: 'View',
    },
  ]);

  private groupTile(config: SettingsGroupConfig, s: SettingsSource | null): Tile {
    const summary = s ? config.summary(s) : { value: '…', detail: 'Loading' };
    const source = s && (s.source === 'database' ? 'saved in Assay' : 'from the environment');
    return {
      id: config.group,
      label: config.title,
      ...summary,
      detail: source ? `${summary.detail} · ${source}` : summary.detail,
      go: 'Edit',
    };
  }

  private workersTile(h: WorkerHealth | null): Tile {
    const tile = { id: 'workers', label: 'Workers', go: 'View' };
    if (!h) return { ...tile, value: '…', detail: 'Checking' };
    const n = h.workers.length;
    const restart = workersToRestart(h).length;
    return {
      ...tile,
      dot: WORKER_STATUS[h.status].color,
      value: WORKER_STATUS[h.status].label,
      detail: !n
        ? 'No worker connected'
        : restart
          ? `${restart} of ${n} need a restart`
          : `${n} worker${n === 1 ? '' : 's'} on the current code`,
    };
  }

  jump(id: string) {
    document.getElementById(`settings-${id}`)?.scrollIntoView();
  }
}
