# Assay FE

Angular 22 front-end for the Assay evaluation API (v0.9.0). Modernist design system (Archivo, red/ink on light ground, zero radius, 2px rules); dark mode via `[data-theme="dark"]`.

## Run
```
npm install
npm start          # http://localhost:4200
```
Backend must allow CORS from `http://localhost:4200`. API base is set in `src/app/app.config.ts` (`ASSAY_API_BASE`).

## Screens → endpoints
- **Overview** - counts, recent executions (all sets/plans), status of the 12 newest executions' runs. New test.
- **Datasets** - list; *Import from JSONL* (`POST /datasets/path`). **Dataset detail** - paged rows (`GET /datasets/{id}/rows`), edit row (`PATCH /datasets/rows`), add rows / replace all rows (paste JSONL → `POST`/`PUT /datasets/rows`), delete selected rows (`DELETE /datasets/rows`), rename (`PATCH /datasets/name`), delete (`DELETE /datasets`), *Create tests from rows* (`POST /tests/from-dataset`).
- **Tests** - list, filter, bulk delete (`DELETE /tests`), New test (`POST /tests`). **Test detail** - edit (`PATCH /tests/{id}`), delete, *Run standalone* (`POST /runs/standalone/{id}`), standalone runs list → **Standalone run detail** (`GET /runs/standalone/{id}/test-runs[/{run}]`).
- **Test sets** - list, New (`POST /test-sets`). **Test set detail** - entries (`GET …/entries`), *Add tests* (`POST …/entries` `[{id}]`), *Unlink* (`PATCH …/entries`), *Delete entries* (`DELETE …/entries`), edit frozen entry (`PATCH …/entries/{entry}`), rename, delete, *Run live* (`POST /runs/test-sets/{id}`), executions + *Replay* (`POST /runs/test-sets/{id}/executions/{exec}`).
- **Test plans** - list, New. **Test plan detail** - linked sets (`GET …/entries`), *Link* (`POST …/entries`), *Remove* (`DELETE …/entries`), rename, delete, Run live / Replay under `/runs/test-plans/…`.
- **Execution** - status counts + run list (`GET …/executions/{exec}/test-runs`), Replay. **Run detail** - status, error, scores, frozen entry snapshot (`GET …/test-runs/{run}`), link to originating test.
- **Test types** - catalogue from `GET /tests/types?test_category=…` (all three categories fetched in parallel), cached by `TestTypesStore` for reuse in the test forms. Category tiles show an active-only count and a one-line blurb; click one to narrow the list to just that category, click again to clear. A legend tile explains the `fast` / `needs reference` / `inactive` tags. Below that: text filter, show-inactive toggle, Refresh, and cards (description, best for, limitations, cost, needs-reference) that expand on click for category, reference requirement, and added date.
- **Guide** - static "How Assay works" explainer: the core dataset/test/test-set/test-plan model, the freeze-on-execution rule, standalone vs. live vs. replay runs, three concrete end-to-end workflows, test-plan linking, run statuses, and a guardrail FAQ. No API calls.

## Structure
`api/` models + one-method-per-endpoint service + root `CatalogStore` + `TestTypesStore` · `shared/` formatters, page.css, dialogs (generic, name, confirm, pick, test form), test-type-picker · one folder per area (`datasets`, `tests`, `scopes`, `runs`, `test-types`, `guide`) · `shell/` header/footer/theme.

## Notes
- Test types: every form (new/edit test, edit entry, create tests from dataset) uses `shared/test-type-picker` - grouped by category, with smart filtering: inactive types are hidden unless the test already has one assigned, a search box narrows by name/description/best-for, category chips narrow to one group, and (shown only when it would do something) a toggle hides types that need a reference the test doesn't have yet. Assigned names no longer in the catalogue are listed separately as removable chips.
- Pagination: every list the API pages (`?offset&limit` + `total`) has a shared pager (Previous/Next, range label, 5/10/25/50 per page) - datasets, dataset rows, tests, test sets/plans, set entries, plan links, executions, execution runs, standalone runs. `shared/paged.ts` holds the page state; `shared/pager.component.ts` renders it. The `CatalogStore` still preloads the first 100 of each catalog for counts, name lookups and the overview. Text filters apply to the current page only. The execution page's status tiles summarise the current page (no aggregate endpoint). Runs are enqueue-only - status stays `Pending` until the worker runs; use Refresh.
- Delete buttons are pre-disabled where the API would 409 (set/plan with executions); other 409s (tests in sets, entries with runs) are shown verbatim.
