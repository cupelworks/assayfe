import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusMarkComponent } from '../shared/status-mark.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { numbered } from '../shared/guide/guide-sections';

/** The Guide's sections, in order: the contents under the title; each one's id is `guide-<its number>`. */
const SECTIONS = [
  'The building blocks',
  'Test types',
  'From editable to frozen',
  'Standalone, live, and replay',
  'Putting it into practice',
  "Test plans link, they don't own",
  'Run lifecycle & statuses',
  'Running with statistics',
  "Guardrails you'll bump into",
];

/**
 * "How Assay works", laid out like Charts (`shared/guide`): a numbered list of the sections under
 * the title, then each section - its red number and title in the first three columns, what it says
 * in the rest, a note under a red rule in the last three. Static: no API calls.
 */
@Component({
  selector: 'assay-guide',
  standalone: true,
  imports: [RouterLink, StatusMarkComponent, GuideHeadComponent, GuideSectionComponent],
  templateUrl: './guide.component.html',
  styleUrls: ['../shared/page.css', '../shared/guide/guide.css', './guide.component.css'],
})
export class GuideComponent {
  sections = numbered('guide-', SECTIONS);
}
