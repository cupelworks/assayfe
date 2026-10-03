import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, expand, forkJoin, map, of, reduce, switchMap } from 'rxjs';
import { Page, ScopeMetadata, TestPlanEntry, TestSetEntry } from './models';
import { TestSetsApiService } from './test-sets-api.service';
import { TestPlansApiService } from './test-plans-api.service';

/** A copy of a test in a set: the set, and the entry (its copy). */
export interface CopyInSet {
  set: ScopeMetadata;
  entry: TestSetEntry;
}

/** Every item of a list, page after page (100 a page). */
function all<T>(page: (offset: number) => Observable<Page<T>>): Observable<T[]> {
  return page(0).pipe(
    expand((p) =>
      p.offset + p.items.length < p.total && p.items.length
        ? page(p.offset + p.items.length)
        : of(),
    ),
    reduce((acc, p) => [...acc, ...p.items], [] as T[]),
  );
}

/**
 * Which test sets hold a copy of each test, and which test plans link each set - read by asking
 * every set for its entries and every plan for its sets, as the API has no lookup the other way
 * yet (docs/to_be_implemented_after_be_version_2/dev_notes.md). Read once, when a page first
 * needs it, and kept for the session; a page that changes what a set holds or a plan links calls
 * `forget()`, and the next page that needs it reads it again.
 *
 * A copy that was unlinked from its set isn't in it any more, so it isn't here - yet it still
 * keeps its test from being deleted (the API's rule).
 */
@Injectable({ providedIn: 'root' })
export class MembershipStore {
  private setsApi = inject(TestSetsApiService);
  private plansApi = inject(TestPlansApiService);

  /** test id → its copies, each in its set; null until read. */
  copies = signal<Map<string, CopyInSet[]> | null>(null);
  /** set id → the plans that link it; null until read. */
  plansOf = signal<Map<string, ScopeMetadata[]> | null>(null);
  private readingCopies = false;
  private readingPlans = false;
  /** Bumped by forget(): a read started before it is dropped when it comes back. */
  private version = 0;

  /** Reads which sets hold a copy of which test - once, unless forgotten. */
  loadCopies() {
    if (this.copies() || this.readingCopies) return;
    this.readingCopies = true;
    const v = this.version;
    all((o) => this.setsApi.testSets(o, 100))
      .pipe(
        switchMap((sets) =>
          sets.length
            ? forkJoin(
                sets.map((set) =>
                  (set.entry_count
                    ? all<TestSetEntry>((o) => this.setsApi.testSetEntries(set.id, o, 100))
                    : of<TestSetEntry[]>([])
                  ).pipe(
                    map((entries) => entries.map((entry) => ({ set, entry }))),
                    catchError(() => of<CopyInSet[]>([])),
                  ),
                ),
              )
            : of<CopyInSet[][]>([]),
        ),
        catchError(() => of<CopyInSet[][]>([])),
      )
      .subscribe((lists) => {
        const byTest = new Map<string, CopyInSet[]>();
        for (const c of lists.flat()) {
          const id = c.entry.test_case_id.id;
          byTest.set(id, [...(byTest.get(id) ?? []), c]);
        }
        this.readingCopies = false;
        if (v === this.version) this.copies.set(byTest);
        else this.loadCopies();
      });
  }

  /** Reads which plans link which set - once, unless forgotten. */
  loadPlans() {
    if (this.plansOf() || this.readingPlans) return;
    this.readingPlans = true;
    const v = this.version;
    all((o) => this.plansApi.testPlans(o, 100))
      .pipe(
        switchMap((plans) =>
          plans.length
            ? forkJoin(
                plans.map((plan) =>
                  all<TestPlanEntry>((o) => this.plansApi.testPlanEntries(plan.id, o, 100)).pipe(
                    map((links) => links.map((l) => ({ plan, set: l.test_set.id }))),
                    catchError(() => of<{ plan: ScopeMetadata; set: string }[]>([])),
                  ),
                ),
              )
            : of<{ plan: ScopeMetadata; set: string }[][]>([]),
        ),
        catchError(() => of<{ plan: ScopeMetadata; set: string }[][]>([])),
      )
      .subscribe((lists) => {
        const bySet = new Map<string, ScopeMetadata[]>();
        for (const l of lists.flat()) bySet.set(l.set, [...(bySet.get(l.set) ?? []), l.plan]);
        this.readingPlans = false;
        if (v === this.version) this.plansOf.set(bySet);
        else this.loadPlans();
      });
  }

  /** What a set holds or a plan links changed: read it again when next needed. */
  forget() {
    this.version++;
    this.copies.set(null);
    this.plansOf.set(null);
  }
}
