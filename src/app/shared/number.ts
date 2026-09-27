import { Directive, input } from '@angular/core';

/** A plain decimal number as a person would type it - "60", "0.75", "-1", ".5" - or null.
 *  Stricter than `Number()`, which also accepts "0x10", "1e2", "Infinity" and whitespace-only
 *  strings; those would otherwise be saved as 16, 100, … without the user meaning to. The one
 *  parser behind every numeric field (settings, test-type thresholds). */
export function parseDecimal(raw: string): number | null {
  const t = raw.trim();
  return /^-?(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : null;
}

/**
 * `<input assayNumber>` - how every numeric field in the app is typed in: a plain text input with
 * a numeric on-screen keyboard, never `type="number"`. With `ngModel`, a number input emits a
 * number, the form stores the text, `ngModel` sees them differ and writes the normalised value
 * back while the user is still typing ("1.0" became "1", a lone "-" cleared the field). As text
 * the value round-trips untouched; `parseDecimal` checks it when the form is sent.
 * `assayNumber="numeric"` offers a digits-only keyboard (whole numbers); the default is decimal.
 */
@Directive({
  selector: 'input[assayNumber]',
  standalone: true,
  host: {
    type: 'text',
    autocomplete: 'off',
    '[attr.inputmode]': "mode() || 'decimal'",
  },
})
export class NumberInputDirective {
  mode = input<'decimal' | 'numeric' | ''>('', { alias: 'assayNumber' });
}
