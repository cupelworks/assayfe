import { Component, input, output, computed } from '@angular/core';
/** Offset/limit pager matching the API's `?offset&limit` + `total` contract. */
@Component({
  selector: 'assay-pager',
  standalone: true,
  template: ` @if (total() > 0) {
    <div class="pager">
      <span>{{ label() }}</span>
      <label class="ps"
        >Per page
        <select class="input" (change)="limitChange.emit(+$any($event.target).value)">
          @for (n of sizes; track n) {
            <option [value]="n" [selected]="n === limit()">{{ n }}</option>
          }
        </select>
      </label>
      <button
        class="btn btn-ghost btn-sm"
        (click)="offsetChange.emit(Math.max(0, offset() - limit()))"
        [disabled]="offset() === 0"
      >
        Previous
      </button>
      <button
        class="btn btn-ghost btn-sm"
        (click)="offsetChange.emit(offset() + limit())"
        [disabled]="offset() + limit() >= total()"
      >
        Next
      </button>
    </div>
  }`,
  styles: [
    `
      .pager {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: flex-end;
        margin-top: 16px;
        font-size: 12px;
        color: var(--color-neutral-500);
      }
      .ps {
        display: flex;
        gap: 8px;
        align-items: center;
        font-size: 12px;
      }
      .ps .input {
        padding: 4px 8px;
        font-size: 12px;
        width: auto;
      }
      .btn-sm {
        font-size: 12px;
        padding: 6px 12px;
      }
    `,
  ],
})
export class PagerComponent {
  total = input.required<number>();
  offset = input.required<number>();
  limit = input.required<number>();
  offsetChange = output<number>();
  limitChange = output<number>();
  sizes = [5, 10, 25, 50];
  Math = Math;
  label = computed(
    () =>
      `${this.offset() + 1}–${Math.min(this.offset() + this.limit(), this.total())} of ${this.total()}`,
  );
}
