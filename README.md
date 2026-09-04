# Handoff: Assay web app (Angular)

## Overview
Full front-end for **Assay**, an LLM evaluation backend (FastAPI, `http://localhost:8000`, OpenAPI at `/docs`). Screens: Overview, Datasets, Tests, Test sets, Test set detail, Test plans, Test plan detail, Execution (run list), Run detail. QA/eval users trigger **live** executions and **replay** past ones; runs are enqueued only and stay `pending` until a worker picks them up.

## About the design files
`reference/Assay App.dc.html` is the **design reference** (HTML, hash-routed, falls back to sample data when the API is unreachable). Not production code — the `../../Downloads/design_handoff_assay_dashboard/angular` folder is the implementation, mirroring it 1:1 with Angular 17+ standalone components, signals, `@if/@for`, `HttpClient`, and route-data → component-input binding.

## Fidelity
High-fidelity, Modernist design system: Archivo, ground `#f3f2f2` / ink `#201e1d` / accent `#ec3013`, zero radius, 2px section rules, flush-left labels. All tokens in `../../Downloads/design_handoff_assay_dashboard/angular/src/styles.css` — never hard-code values it carries. Dark mode: `[data-theme="dark"]` block at the end of `styles.css`; `ThemeService` persists light/dark/system and follows `prefers-color-scheme`.

## Setup
1. `ng new AssayFE --standalone --style=css --routing --skip-tests` (Angular ≥17).
2. Replace the generated `src/` with `../../Downloads/design_handoff_assay_dashboard/angular/src`.
3. Backend: add `CORSMiddleware` allowing `http://localhost:4200`.
4. `ng serve`.

## File map
- `app/api/assay-api.service.ts` — typed client for every endpoint used. `api-base.token.ts` — base URL DI token.
- `app/api/catalog.store.ts` — root store: loads the four catalogs, all executions (per set/plan), runs of the 12 newest executions. Pages read its signals; mutations call `store.load()`.
- `app/shell/*` — header (brand, nav, connection dot, Refresh, Dark/Light), error banner, footer, `<router-outlet>`.
- `app/overview/*` — stats (link to catalogs), recent executions table, run-status bar.
- `app/catalog/catalog-list.component.*` — one component for all four lists; `kind` from route data. Filter input; set/plan names link to detail.
- `app/detail/scope-detail.component.*` — test set or plan: entries table (plan = entries across linked sets), execution list with Replay, "Run live" primary action, result/409 message.
- `app/execution/*` — one execution: status counts + run table; "Replay this execution".
- `app/run/*` — one run: status/timing, error, scores with bars, frozen entry snapshot (types, input, expected, model output).
- `app/shared/format.ts` — `rel()`, `short()`, `STATUS` colors, `errText()` (reads FastAPI `detail`).
- `app.routes.ts`, `app.config.ts`, `app.component.ts`, `main.ts`, `index.html`.

## API used (verify against /docs)
- `GET /datasets | /tests | /test-sets | /test-plans` (`?offset&limit`, `{items}` or array)
- `GET /test-sets/{id}/entries` → frozen entries (`name,input,expected_output,model_output,test_type_names,has_runs?`)
- `GET /test-plans/{id}/entries` → links (`test_set_id`) — detail page fans out to each set's entries
- `GET /runs/{test-sets|test-plans}/{id}/executions` → `{id,created_at,run_count,replayed_execution_id}`
- `GET .../executions/{execId}/test-runs` → `{id,status,created_at,test_set_entry_id}`
- `GET .../test-runs/{runId}` → run details + entry snapshot (`scores`, `error`, `executed_at`, `test_case_snapshot_at`)
- `POST /runs/{kind}/{id}` live · `POST /runs/{kind}/{id}/executions/{execId}` replay — 201 `{id,run_count}`; 404/409 `detail` shown verbatim
Field names for entries/run details were inferred from the dev notes — adjust the interfaces in `assay-api.service.ts` if the schema differs.

## Layout system (all screens)
- Page header: optional breadcrumb row (12px, 1px rule) → hero (48/40/24 padding, kicker 11px uppercase accent, h1 44px/1.05/-.02em, actions bottom-right) → optional message strip (surface fill; accent-100/accent-700 on error) → content. Every boundary is a 2px `--color-divider` rule; cells are 32/40 padding; sub-rows 1px rules.
- Status colors: pending neutral-400, running accent-400, completed text, failed accent.
- Tags: scope `tag-neutral`, Live `tag-accent`, Replay `tag-outline`, test types `tag-outline`.
- Buttons: primary = Run live / Replay this execution; ghost = per-execution Replay; secondary = Refresh.

## Not built (ask before adding)
Create/edit forms (datasets upload, test authoring, add entries, link sets), standalone (single test) runs, pagination past 100, run polling.
