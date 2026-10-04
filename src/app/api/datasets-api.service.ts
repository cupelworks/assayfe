import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase, QUERY } from './api-base';
import { ListParams } from '../shared/work/api-list';

@Injectable({ providedIn: 'root' })
export class DatasetsApiService extends ApiBase {
  /** The datasets the parameters let through (API 2.0: search, filters, sort - `ListParams`). */
  datasets(offset = 0, limit = 100, params: ListParams = {}) {
    return this.http.get<M.Page<M.DataSetMetadata>>(this.u('/datasets'), {
      params: QUERY({ ...params, offset, limit }),
    });
  }
  dataset(id: string) {
    return this.http.get<M.DataSetMetadata>(this.u(`/datasets/${id}`));
  }
  /** A dataset's rows by number - those whose prompt or answers hold every phrase of `q`. */
  datasetRows(id: string, offset = 0, limit = 50, q: readonly string[] = []) {
    return this.http.get<M.DataSetRowPage>(this.u(`/datasets/${id}/rows`), {
      params: QUERY({ offset, limit, q }),
    });
  }
  createDatasetFromPath(path: string, dataset_name: string) {
    return this.http.post<M.DataSetImportResult>(this.u('/datasets/path'), { path, dataset_name });
  }
  addDatasetRows(id: string, rows: M.DataSetRowSchema[]) {
    return this.http.post<M.DataSetImportResult>(this.u('/datasets/rows'), { id, rows });
  }
  replaceDatasetRows(id: string, rows: M.DataSetRowSchema[]) {
    return this.http.put<M.DataSetImportResult>(this.u('/datasets/rows'), { id, rows });
  }
  updateDatasetRows(rows: Pick<M.DataSetRow, 'id' | 'row_info'>[]) {
    return this.http.patch<M.DataSetMutationResult>(this.u('/datasets/rows'), rows);
  }
  deleteDatasetRows(row_ids: string[]) {
    return this.http.delete<M.DataSetMutationResult>(this.u('/datasets/rows'), {
      body: { row_ids },
    });
  }
  renameDataset(id: string, name: string) {
    return this.http.patch<M.DataSetInfo>(this.u('/datasets/name'), { id, name });
  }
  deleteDataset(id: string) {
    return this.http.delete<M.DataSetDeletedData>(this.u('/datasets'), { body: { id } });
  }
}
