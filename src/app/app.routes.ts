import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';

// Every page loads the first time it's opened, in a file of its own: the app's first download is
// the shell (the bar and the frame), and a page comes with what only it uses.
const runStats = () => import('./statistics/run-stats.component').then((m) => m.RunStatsComponent);
const scopesList = () =>
  import('./scopes/scopes-list.component').then((m) => m.ScopesListComponent);

// Route data keys map onto component inputs via withComponentInputBinding().
export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./overview/overview.component').then((m) => m.OverviewComponent),
      },
      {
        path: 'runs',
        loadComponent: () => import('./runs/runs-list.component').then((m) => m.RunsListComponent),
      },
      {
        path: 'datasets',
        loadComponent: () =>
          import('./datasets/datasets-list.component').then((m) => m.DatasetsListComponent),
      },
      {
        path: 'datasets/:id',
        loadComponent: () =>
          import('./datasets/dataset-detail.component').then((m) => m.DatasetDetailComponent),
      },
      {
        path: 'tests',
        loadComponent: () =>
          import('./tests/tests-list.component').then((m) => m.TestsListComponent),
      },
      {
        path: 'tests/:id',
        loadComponent: () =>
          import('./tests/test-detail.component').then((m) => m.TestDetailComponent),
      },
      {
        path: 'tests/:id/runs/:runId',
        loadComponent: () =>
          import('./runs/standalone-run-detail.component').then(
            (m) => m.StandaloneRunDetailComponent,
          ),
      },
      {
        path: 'tests/:id/run-with-statistics',
        loadComponent: runStats,
        data: { scopeKind: 'test' },
      },
      { path: 'test-sets', loadComponent: scopesList, data: { kind: 'test-sets' } },
      { path: 'test-plans', loadComponent: scopesList, data: { kind: 'test-plans' } },
      {
        path: 'test-sets/:id',
        loadComponent: () =>
          import('./scopes/test-set-detail.component').then((m) => m.TestSetDetailComponent),
      },
      {
        path: 'test-plans/:id',
        loadComponent: () =>
          import('./scopes/test-plan-detail.component').then((m) => m.TestPlanDetailComponent),
      },
      {
        path: 'test-sets/:id/run-with-statistics',
        loadComponent: runStats,
        data: { scopeKind: 'test_set' },
      },
      {
        path: 'test-plans/:id/run-with-statistics',
        loadComponent: runStats,
        data: { scopeKind: 'test_plan' },
      },
      {
        path: ':kind/:id/executions/:execId',
        loadComponent: () => import('./runs/execution.component').then((m) => m.ExecutionComponent),
      },
      {
        path: ':kind/:id/executions/:execId/runs/:runId',
        loadComponent: () =>
          import('./runs/run-detail.component').then((m) => m.RunDetailComponent),
      },
      {
        path: 'statistics/batches/:id',
        loadComponent: () => import('./statistics/batch.component').then((m) => m.BatchComponent),
      },
      {
        path: 'statistics/comparisons/:id',
        loadComponent: () =>
          import('./statistics/comparison.component').then((m) => m.ComparisonComponent),
      },
      {
        path: 'test-types',
        loadComponent: () =>
          import('./test-types/test-types.component').then((m) => m.TestTypesComponent),
      },
      {
        path: 'statistical-tests',
        loadComponent: () =>
          import('./statistics/statistical-tests.component').then(
            (m) => m.StatisticalTestsComponent,
          ),
      },
      {
        path: 'charts',
        loadComponent: () => import('./charts/charts.component').then((m) => m.ChartsComponent),
      },
      {
        path: 'guide',
        loadComponent: () => import('./guide/guide.component').then((m) => m.GuideComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/settings.component').then((m) => m.SettingsComponent),
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
