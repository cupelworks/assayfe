import { Component, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogComponent } from './dialog.component';
export interface PickRow { id: string; name: string; sub?: string; meta?: string; disabled?: boolean; dim?: boolean; }
/** Filterable multi-select; parent performs the request and passes busy/error back in. */
@Component({
  selector: 'assay-pick-dialog', standalone: true, imports: [DialogComponent, FormsModule],
  templateUrl: './pick-dialog.component.html', styleUrl: './pick-dialog.component.css',
})
export class PickDialogComponent {
  kicker = input(''); title = input.required<string>(); rows = input.required<PickRow[]>();
  submitLabel = input<(n: number) => string>(n => `Add ${n || ''}`); emptyText = input('Nothing to pick.');
  busy = input(false); error = input<string | null>(null);
  confirm = output<string[]>(); closed = output<void>();
  filter = signal(''); picked = signal<string[]>([]);
  shown = computed(() => { const f = this.filter().toLowerCase(); return f ? this.rows().filter(r => (r.name + ' ' + (r.sub ?? '')).toLowerCase().includes(f)) : this.rows(); });
  toggle(id: string) { this.picked.update(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }
  all() { const ids = this.shown().filter(r => !r.disabled).map(r => r.id); this.picked.set(ids.every(i => this.picked().includes(i)) ? [] : ids); }
}
