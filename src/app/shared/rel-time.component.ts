// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input } from '@angular/core';
import { rel, absTime } from './format';

/**
 * A relative timestamp ("4 d ago") with the exact date/time as its hover tooltip - the one
 * display shape every list/detail page in the app uses for a plain date, extracted here so it
 * can't silently drift out of sync page to page. One page (the test sets/plans list) was missing
 * the tooltip half of this entirely before this existed.
 *
 * Renders unstyled (a bare inline span) - the caller's own wrapping element supplies `.muted`/
 * `.small`/etc., which this inherits normally. For a date that needs a text prefix ("snapshot
 * 4 d ago"), put the prefix as a plain text sibling rather than inside this component.
 */
@Component({
  selector: 'assay-rel-time',
  standalone: true,
  template: `<span [title]="absTime(iso())">{{ rel(iso()) }}</span>`,
})
export class RelTimeComponent {
  iso = input<string | null | undefined>(null);
  rel = rel;
  absTime = absTime;
}
