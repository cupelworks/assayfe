// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusMarkComponent } from '../shared/status-mark.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { GuideGoComponent } from '../shared/guide/guide-go.component';
import { numbered } from '../shared/guide/guide-sections';
import { GuideArrowComponent } from './guide-arrow.component';
import { FlowStep, GuideFlowComponent } from './guide-flow.component';
import { GuideMarkComponent } from './guide-mark.component';

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
  imports: [
    RouterLink,
    StatusMarkComponent,
    GuideHeadComponent,
    GuideSectionComponent,
    GuideGoComponent,
    GuideArrowComponent,
    GuideFlowComponent,
    GuideMarkComponent,
  ],
  templateUrl: './guide.component.html',
  styleUrls: ['../shared/page.css', '../shared/guide/guide.css', './guide.component.css'],
})
export class GuideComponent {
  sections = numbered('guide-', SECTIONS);
  /** 05's three workflows, each a line of things and what makes the next. */
  flows: Record<'quick' | 'set' | 'plan', FlowStep[]> = {
    quick: [{ node: 'Test' }, { edge: 'Run standalone' }, { node: 'Run' }],
    set: [
      { node: 'Dataset' },
      { edge: 'Import rows' },
      { node: 'Test' },
      { edge: 'Add to set' },
      { node: 'Test set entry' },
      { edge: 'Run live / replay' },
      { node: 'Run' },
    ],
    plan: [
      { node: 'Test set' },
      { edge: 'Link to plan' },
      { node: 'Test plan' },
      { edge: 'Run live / replay' },
      { node: 'Run', note: '× every entry, every linked set' },
    ],
  };
}
