import { Component } from '@angular/core';
import { OPERATIONS } from './settings-fields';
import { SettingsGroupComponent } from './settings-group.component';
import { JUDGE_GROUP, TARGET_GROUP } from './settings-groups';

/** /settings - what Assay tests and how it's set up. The editable groups - the application under
 *  test and the LLM judge - are the same SettingsGroupComponent, each with its own config
 *  (settings-groups.ts), since every group has the same endpoints (/settings/<group>) and
 *  lifecycle. The read-only operations tiles are static content from `settings-fields.ts` - no
 *  endpoint exposes that group - and never show a connection string. */
@Component({
  selector: 'assay-settings',
  standalone: true,
  imports: [SettingsGroupComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['../shared/page.css', './settings-section.css', './settings.component.css'],
})
export class SettingsComponent {
  target = TARGET_GROUP;
  judge = JUDGE_GROUP;
  operations = OPERATIONS;
}
