import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';
import { OverviewComponent } from './overview/overview.component';
import { DatasetsListComponent } from './datasets/datasets-list.component';
import { DatasetDetailComponent } from './datasets/dataset-detail.component';
import { TestsListComponent } from './tests/tests-list.component';
import { TestDetailComponent } from './tests/test-detail.component';
import { ScopesListComponent } from './scopes/scopes-list.component';
import { TestSetDetailComponent } from './scopes/test-set-detail.component';
import { TestPlanDetailComponent } from './scopes/test-plan-detail.component';
import { ExecutionComponent } from './runs/execution.component';
import { RunDetailComponent } from './runs/run-detail.component';
import { StandaloneRunDetailComponent } from './runs/standalone-run-detail.component';

// Route data keys map onto component inputs via withComponentInputBinding().
export const routes: Routes = [{
  path: '', component: ShellComponent, children: [
    { path: '', component: OverviewComponent },
    { path: 'datasets', component: DatasetsListComponent },
    { path: 'datasets/:id', component: DatasetDetailComponent },
    { path: 'tests', component: TestsListComponent },
    { path: 'tests/:id', component: TestDetailComponent },
    { path: 'tests/:id/runs/:runId', component: StandaloneRunDetailComponent },
    { path: 'test-sets', component: ScopesListComponent, data: { kind: 'test-sets' } },
    { path: 'test-plans', component: ScopesListComponent, data: { kind: 'test-plans' } },
    { path: 'test-sets/:id', component: TestSetDetailComponent },
    { path: 'test-plans/:id', component: TestPlanDetailComponent },
    { path: ':kind/:id/executions/:execId', component: ExecutionComponent },
    { path: ':kind/:id/executions/:execId/runs/:runId', component: RunDetailComponent },
    { path: '**', redirectTo: '' },
  ],
}];
