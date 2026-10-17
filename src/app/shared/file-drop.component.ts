import { Component, input, model, signal } from '@angular/core';
import { bytesText } from './format';

/**
 * A file from the reader's computer, as a field: a box ruled as a field is (the global .ruled) -
 * "Drop a .jsonl file here, or choose one from your computer"; while a file is dragged over it,
 * the thick red rule of a chosen tile; once one is chosen, its name and size, and "Choose
 * another" (a drop replaces it too). A touch screen can't drop: there the box holds only the
 * button - "Choose a .jsonl file". `invalid`: the chosen file is refused - its size and its line
 * in red. It holds the file (`file`, two-way) and reads nothing of it.
 */
@Component({
  selector: 'assay-file-drop',
  standalone: true,
  template: `
    <input #picker type="file" class="picker" [accept]="accept()" (change)="picked(picker)" />
    @if (file(); as f) {
      <div
        class="box file ruled"
        [class.bad]="invalid()"
        (dragover)="over($event)"
        (dragleave)="leave($event)"
        (drop)="dropped($event)"
      >
        <span class="name">{{ f.name }}</span
        ><span class="size">{{ size(f) }}</span>
        <button
          type="button"
          class="pick"
          [attr.aria-describedby]="describedBy()"
          (click)="picker.click()"
        >
          Choose another
        </button>
      </div>
    } @else {
      <div
        class="box drop ruled"
        [class.on]="dragging()"
        (dragover)="over($event)"
        (dragleave)="leave($event)"
        (drop)="dropped($event)"
      >
        <span class="big">{{
          dragging() ? 'Drop the file to choose it' : 'Drop ' + noun() + ' here'
        }}</span>
        <span class="or"
          ><span class="fine">or </span
          ><button
            type="button"
            class="pick"
            [attr.aria-describedby]="describedBy()"
            (click)="picker.click()"
          >
            <span class="fine">choose one from your computer</span
            ><span class="coarse">Choose {{ noun() }}</span>
          </button></span
        >
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    /* The browser's own picker never shows - not even inside a field (.lfield), whose inputs are
       restyled to lines: the box's buttons open it. */
    .picker {
      display: none;
    }
    .drop {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 20px 0 21px;
    }
    .drop.on {
      padding-top: 17px;
      border-top: 4px solid var(--color-accent);
    }
    .big {
      font-size: 15px;
      font-weight: 600;
    }
    .drop.on .big {
      color: var(--color-accent);
    }
    .or {
      font-size: 13px;
      color: var(--color-neutral-600);
    }
    .file {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 14px;
      padding: 14px 0 15px;
    }
    .file.bad {
      border-bottom-color: var(--color-accent);
    }
    .name {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 14px;
      color: var(--color-text);
      overflow-wrap: anywhere;
    }
    .size {
      font-size: 13px;
      color: var(--color-neutral-600);
      font-variant-numeric: tabular-nums;
    }
    .file.bad .size {
      font-weight: 700;
      color: var(--color-accent);
    }
    .file .pick {
      margin-left: auto;
    }
    .pick {
      all: unset;
      font-size: 13px;
      font-weight: 700;
      color: var(--color-accent);
      cursor: pointer;
    }
    .pick:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .pick:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    .coarse {
      display: none;
    }
    /* A touch screen: no dropping - the box is the button. */
    @media (pointer: coarse) {
      .drop {
        padding: 0;
      }
      .big,
      .fine {
        display: none;
      }
      .coarse {
        display: inline;
      }
      .drop .pick {
        display: flex;
        align-items: center;
        min-height: 64px;
        font-size: 15px;
      }
    }
  `,
})
export class FileDropComponent {
  /** What the picker offers: ".jsonl". */
  accept = input('');
  /** What it takes, in words, after "Drop" and "Choose": "a .jsonl file". */
  noun = input('a file');
  /** The chosen file is refused: its size and its line in red. */
  invalid = input(false);
  /** The id of what describes it - the help under it - for its button. */
  describedBy = input<string | null>(null);
  file = model<File | null>(null);
  dragging = signal(false);
  size = (f: File) => bytesText(f.size);

  /** Chosen with the picker. Its value is let go, so choosing the same file again - fixed since -
   *  is a choice too. */
  picked(picker: HTMLInputElement) {
    const f = picker.files?.[0];
    picker.value = '';
    if (f) this.file.set(f);
  }
  over(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    this.dragging.set(true);
  }
  /** Out of the box - not merely onto something inside it. */
  leave(e: DragEvent) {
    const box = e.currentTarget as HTMLElement;
    if (!box.contains(e.relatedTarget as Node | null)) this.dragging.set(false);
  }
  dropped(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) this.file.set(f);
  }
}
