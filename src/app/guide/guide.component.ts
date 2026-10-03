import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusMarkComponent } from '../shared/status-mark.component';

/** The Guide's sections, in order: the contents list under the title and each section's id. */
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
 * "How Assay works", on the app's 12-column grid like the chart guide: a numbered list of the
 * sections under the title, then each section - its red number and title in the first three
 * columns, what it says in the rest, a note under a red rule in the last three. Static: no API
 * calls.
 */
@Component({
  selector: 'assay-guide',
  standalone: true,
  imports: [RouterLink, StatusMarkComponent],
  templateUrl: './guide.component.html',
  styleUrls: ['../shared/page.css', './guide.component.css'],
})
export class GuideComponent {
  sections = SECTIONS.map((label, i) => {
    const no = String(i + 1).padStart(2, '0');
    return { no, label, id: `guide-${no}` };
  });
  /** A link in the contents: to its section, also when the fragment is already the route's (the
   *  router wouldn't scroll again). */
  go(id: string) {
    setTimeout(() => document.getElementById(id)?.scrollIntoView());
  }
}
