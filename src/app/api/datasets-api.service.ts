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
  /** The datasets' counts beside each filter value, within the others chosen - the list's own
   *  parameters, and the Created edges to count from. */
  datasetFacets(params: ListParams, edges: readonly string[]) {
    return this.http.get<M.FacetCounts>(this.u('/datasets/facets'), {
      params: QUERY({ ...params, sort: undefined, created_edges: edges }),
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
  /** A .jsonl file from the reader's computer as a new dataset - all or nothing (API 2.3.0). */
  uploadDataset(file: File, dataset_name: string) {
    const body = new FormData();
    body.append('file', file);
    body.append('dataset_name', dataset_name);
    return this.http.post<M.DataSetImportResult>(this.u('/datasets/upload'), body);
  }
  /** The largest file `uploadDataset` takes. */
  uploadLimit() {
    return this.http.get<M.DatasetUploadLimit>(this.u('/datasets/upload'));
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
