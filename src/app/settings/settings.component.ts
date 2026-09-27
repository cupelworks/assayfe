import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { APPLICATION_FIELDS, JUDGE_PLACEHOLDERS, OPERATIONS, envVar } from './settings-fields';

/** /settings - how this Assay instance is deployed and what it tests. Read-only for now: the
 *  backend exposes no settings endpoint (every value is an `ASSAY_*` env var read at process
 *  start), so the application-under-test group is drawn as the form it will become, showing the
 *  documented defaults with saving disabled; the LLM-judge group is a placeholder until the
 *  evaluators' phase 7; operations are deliberately read-only and never show a connection
 *  string. Everything rendered comes from `settings-fields.ts` - the template is three loops. */
@Component({
  selector: 'assay-settings',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './settings.component.html',
  styleUrls: ['../shared/page.css', './settings.component.css'],
})
export class SettingsComponent {
  fields = APPLICATION_FIELDS;
  judge = JUDGE_PLACEHOLDERS;
  operations = OPERATIONS;
  envVar = envVar;
  /** The one caveat both value-showing groups carry, worded once. */
  defaultsNote = "Showing the backend's defaults - the API doesn't expose the live values yet.";
  controlId = (key: string) => `setting-${key}`;
}
