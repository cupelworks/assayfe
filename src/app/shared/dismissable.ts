// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { DestroyRef, ElementRef, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Why a popover closed: Escape (focus goes back to what opened it), a click outside it, or the
 *  page changing under it. */
export type DismissReason = 'escape' | 'outside' | 'navigation';

/**
 * Closes a popover - a header menu's panel, the phone's menu - while `isOpen()`: when the
 * page changes, a click lands outside the component that calls it, or Escape is pressed. Call it
 * once from that component's constructor, as `pollWhile`: its listeners go with the component.
 */
export function dismissable(isOpen: () => boolean, close: (why: DismissReason) => void): void {
  const host: HTMLElement = inject(ElementRef).nativeElement;
  const doc = inject(DOCUMENT);
  const onClick = (e: MouseEvent) => {
    if (isOpen() && !host.contains(e.target as Node)) close('outside');
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen()) close('escape');
  };
  doc.addEventListener('click', onClick);
  doc.addEventListener('keydown', onKey);
  const navigation = inject(Router)
    .events.pipe(filter((e) => e instanceof NavigationEnd))
    .subscribe(() => isOpen() && close('navigation'));
  inject(DestroyRef).onDestroy(() => {
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('keydown', onKey);
    navigation.unsubscribe();
  });
}
