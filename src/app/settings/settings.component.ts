import { Component } from '@angular/core';
import { JUDGE_PLACEHOLDERS, OPERATIONS } from './settings-fields';
import { TargetSettingsComponent } from './target-settings.component';

/** /settings - what Assay tests and how it's set up. The application-under-test section is its
 *  own component (it loads, saves, resets and tests against /settings/target); the LLM-judge
 *  placeholders and the read-only operations tiles are static content from `settings-fields.ts`,
 *  since no endpoint exposes those groups yet. Operations never show a connection string. */
@Component({
  selector: 'assay-settings',
  standalone: true,
  imports: [TargetSettingsComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['../shared/page.css', './settings-section.css', './settings.component.css'],
})
export class SettingsComponent {
  judge = JUDGE_PLACEHOLDERS;
  operations = OPERATIONS;
}
