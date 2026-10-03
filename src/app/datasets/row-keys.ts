import { CatalogKeyItem } from '../shared/catalog';

/** What each row of a dataset holds - its file's keys, their names on a page, what they mean. */
export const ROW_KEYS = [
  { key: 'prompt', label: 'Prompt', text: 'the question' },
  { key: 'expected_output', label: 'Expected output', text: 'what a good answer says' },
  {
    key: 'model_output',
    label: 'Model output',
    text: 'an answer recorded once, scored instead of asking the application',
  },
] as const;

/** The same, as a page's key under its lede (the Datasets list, a dataset's page). */
export const ROW_KEY: CatalogKeyItem[] = ROW_KEYS.map((k) => ({
  tag: { text: k.label },
  text: k.text,
}));
