# Assay FE

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/cupelworks/assay/main/.github/assets/assay-dark.png">
    <img src="https://raw.githubusercontent.com/cupelworks/assay/main/.github/assets/assay-light.png" alt="Assay, cast by CupelWorks: write the test once, run it as often as you choose, get a verdict" width="100%">
  </picture>
</p>

Test how a GenAI-powered application behaves, and keep a reproducible record of it.

Bring the prompts you send your application, the answers it gave and the answers you
expected. Assay scores each case with the checks you assign — deterministic rules, NLP
metrics against a threshold, LLM-as-judge verdicts against a rubric — organises cases into
stable test sets and plans, and records every run's outcome.

See how Assay works, step by step, at [cupel.works/assay/how-it-works](https://cupel.works/assay/how-it-works).

**This repository is Assay's front end**: the web interface for Assay's API, which is
[cupelworks/assay](https://github.com/cupelworks/assay). It runs as one container: the built
app, served by nginx, which also forwards `/api` to the API.

## License

Copyright (C) 2026 Francesco Campanile.

Assay FE is free software: you can redistribute it and/or modify it under the terms of the
[GNU Affero General Public License, version 3](LICENSE) (`AGPL-3.0-only`), as published by
the Free Software Foundation. It is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full terms.

Every source file carries this notice in its first two lines. If you run a modified Assay FE for
others to use over a network, the AGPL asks you to offer them its source code.

The Archivo typeface, served with the app from `@fontsource-variable/archivo`, is Copyright 2020
The Archivo Project Authors, under the [SIL Open Font License 1.1](https://openfontlicense.org).

## Contributing

Assay is open source, but it doesn't accept pull requests or other code contributions.
Issues are welcome: open one to report a bug or suggest an idea. See
[CONTRIBUTING.md](CONTRIBUTING.md). Report security vulnerabilities privately, as
[SECURITY.md](SECURITY.md) explains, never in a public issue.

## Contents

- [What it does](#what-it-does)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Pages](#pages)
- [API](#api)
- [Development](#development)

## What it does

- **Overview.** Whether runs can start, from the workers, and how the last 100 batches and the
  last 500 runs ended.
- **Datasets.** Import a `.jsonl` file from your computer, up to the server's limit; see its
  rows, and make tests from them.
- **Tests.** Write a test with the checks it needs. Each check's settings come from what the API
  says the check takes. Filter your tests by their latest verdict, their checks and more.
- **Test sets and test plans.** Group tests into sets, and sets into plans; run any of them live.
- **Runs.** Every run as it happens: its status, the answer it got, and what each check judged.
- **Run with statistics.** Run a test, a set or a plan many times as one batch, and get a verdict
  per check: Passed, Failed or Inconclusive. Compare two batches.
- **Reference.** The check types, the statistical tests, how to read the charts, and a guide to
  how Assay works.
- **Settings.** The application under test and the LLM judge, with a connection test before you
  save; whether the workers are ready; how the deployment runs, read-only.
- **Who is signed in.** Behind a sign-in, the header shows your name, with Sign out.
- **Light and dark.** A theme switch, or your system's.

## Getting started

### Try it: Docker Compose

Requires [Docker](https://docs.docker.com/get-docker/), and Assay's API on port 8000:
`docker compose up --build` in a clone of [cupelworks/assay](https://github.com/cupelworks/assay)
starts it. Then, from this repository's root:

```bash
docker compose up --build
```

This builds the app and serves it with nginx, which forwards `/api` to the API on your machine.
Open <http://localhost:8080>. The image is about 90 MB. If you run the API by hand with uvicorn
instead, set `ASSAY_ROOT_PATH=/api` in its `.env`, so its docs page works through this container.

For another API, or another upload limit, put `ASSAY_API_URL` or `ASSAY_UPLOAD_MAX_MB` in a
`.env` file next to `docker-compose.yml`, as `NAME=value` lines (see
[Configuration](#configuration)).

Ctrl+C stops it and keeps the image for the next `docker compose up`. Add `-d` to run it in the
background instead, and `docker compose stop` stops it. To clean up, from the same folder:

| Command | Removes |
|---|---|
| `docker compose down` | The container; the image is kept |
| `docker compose down --rmi all` | The container and the image; the next `docker compose up --build` builds it again |

### Develop: Node on your machine

Requires Node 26 (or 22.22.3+, or 24.15+), and Assay's API on <http://localhost:8000>.

```bash
npm ci
npm start    # ng serve, with /api forwarded to the API
```

Open <http://localhost:4200>. `ng serve` forwards `/api` to <http://localhost:8000> without the
`/api`, and `/openapi.json` for the API's docs page (`proxy.conf.json`), so the API needs no CORS
for it. For an API elsewhere, change the target there.

### Deploy: Azure

Assay deploys to Azure Container Apps with Terraform, from the API's repository: see its
[infra/azure/README.md](https://github.com/cupelworks/assay/blob/main/infra/azure/README.md). This
front end is the only public app, behind Entra ID sign-in; the API has no public address, and
nginx forwards `/api` to it. A release is `develop` merged into `main` and tagged `vX.Y.Z` with
`package.json`'s version (CI checks that they match). The deploy pipeline builds the image from
that tag, once `scripts/check-api-version.mjs` has checked the API's version.

## Configuration

The container reads these when it starts, and stops at once when one is missing or wrong:

| Variable | Default | What it sets |
|---|---|---|
| `ASSAY_API_URL` | none: required; with Docker Compose, the API on your machine | The API's address, such as `https://assay-api.internal.example`. nginx forwards `/api/...` there, without the `/api` |
| `ASSAY_UPLOAD_MAX_MB` | `11` | The largest request nginx lets through, in MB: one more than the API's `ASSAY_DATASET_UPLOAD_MAX_MB` (10 by default), for the form around the file |

The rest is fixed in the image (`nginx/`): `/healthz` answers the platform's probes, every app
route serves the app, built files are cached for a year (their names change with their content),
and every page carries security headers, a content security policy among them. `/.assay/me` tells
the app who is signed in, from the sign-in's own header, and an API on HTTPS must show a valid
certificate. With Docker Compose, the variables go in a `.env` file next to `docker-compose.yml`.
`ng serve` doesn't read them: in development, `proxy.conf.json` sets where `/api` goes.

## Pages

| Page | Path | What it shows |
|---|---|---|
| Overview | `/` | Whether runs can start, and how the last batches and runs ended |
| Datasets | `/datasets` | Your datasets; a dataset's page has its rows |
| Tests | `/tests` | Your tests; a test's page has its checks and its runs |
| Test sets, Test plans | `/test-sets`, `/test-plans` | Your sets and plans; each one's page runs it |
| A run | under its test, set or plan | The answer it got and what each check judged |
| Runs | `/runs` | Every run started one at a time |
| Batches, Comparisons | `/statistics/batches`, `/statistics/comparisons` | The runs with statistics, and two batches compared |
| Run with statistics | `/tests/:id/run-with-statistics`, also under `/test-sets` and `/test-plans` | A batch's setup: the goal, its size, a trial first. Opens in a new tab |
| Test types | `/test-types` | Every check the API offers |
| Statistical tests | `/statistical-tests` | The statistical tests a batch can use |
| Charts | `/charts` | How to read the charts |
| Guide | `/guide` | How Assay works |
| Settings | `/settings` | The application under test, the LLM judge, the workers and the deployment |

## API

The app calls Assay's API at `/api`, on its own origin: in the container nginx forwards it to
`ASSAY_API_URL`, and in development `ng serve` forwards it to <http://localhost:8000>. The footer
links the API's own reference, at `/api/docs`.

`assay.api` in `package.json` is the API this front end works with, as a range: `^2.4.0` means
2.4.0 or any later 2.x. To check a version:

```bash
node scripts/check-api-version.mjs 2.4.1    # exit 0 in the range, 1 outside it
```

The front end has a version of its own, apart from the API's: `version` in `package.json`, which
the footer shows.

## Development

```bash
npm start               # the dev server, on http://localhost:4200
npx ng build            # a production build, in dist/AssayFE/browser
npm run format:check    # Prettier, over src/
npm run check:license   # the licence notice in every source file
```

The pre-commit hook runs the last two. There's no automated test suite: each change is checked
by hand in the browser, against a live API and worker. CI (`.github/workflows/ci.yml`) runs the
checks and the build, and builds and tries the container image.

**Layout:** `src/app/` holds the API client (`api/`: the models, one service per area, the
catalogue stores, the `/api` base and the sign-in interceptor), the shell (`shell/`: the header,
the footer, who is signed in), one folder per area (`overview`, `datasets`, `tests`, `scopes` for
test sets and plans, `runs`, `statistics`, `test-types`, `charts`, `guide`, `settings`, `theme`)
and the pieces they share (`shared/`: the pager, dialogs, filters, status marks, and the layouts
of a guide page and a catalogue page). `src/styles.css` holds the design system: Archivo, red and
ink on a light ground, square corners, 2 px rules, and dark mode through `[data-theme="dark"]`.
`nginx/` and the `Dockerfile` build the container; `scripts/` holds the licence and API-version
checks.
