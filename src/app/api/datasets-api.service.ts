import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase, PAGE } from './api-base';

@Injectable({ providedIn: 'root' })
export class DatasetsApiService extends ApiBase {
  datasets(offset = 0, limit = 100) {
    return this.http.get<M.Page<M.DataSetMetadata>>(this.u('/datasets'), {
      params: PAGE(offset, limit),
    });
  }
  dataset(id: string) {
    return this.http.get<M.DataSetMetadata>(this.u(`/datasets/${id}`));
  }
  datasetRows(id: string, offset = 0, limit = 50) {
    return this.http.get<M.DataSetRowPage>(this.u(`/datasets/${id}/rows`), {
      params: PAGE(offset, limit),
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
