import { Component, computed, signal } from '@angular/core';
import { SettingsSource } from '../api/models';
import { OPERATIONS } from './settings-fields';
import { SettingsGroupComponent } from './settings-group.component';
import { JUDGE_GROUP, SettingsGroupConfig, TARGET_GROUP } from './settings-groups';

interface Tile {
  id: string;
  label: string;
  value: string;
  detail: string;
  mono?: boolean;
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
  imports: [SettingsGroupComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['../shared/page.css', './settings.component.css'],
})
export class SettingsComponent {
  target = TARGET_GROUP;
  judge = JUDGE_GROUP;
  operations = OPERATIONS;
  saved = {
    target: signal<SettingsSource | null>(null),
    judge: signal<SettingsSource | null>(null),
  };

  tiles = computed<Tile[]>(() => [
    this.groupTile(this.target, this.saved.target()),
    this.groupTile(this.judge, this.saved.judge()),
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

  jump(id: string) {
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth' });
  }
}
