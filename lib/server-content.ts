import { cache } from 'react';
import { getDatabase } from './database';
import { publicContent } from './schema';

// Deduplicate layout, metadata and page reads within one render only.
// Fresh requests still read the current publication state.
export const readServerContent = cache(async () => (await getDatabase()).read());

// Reuse the same public projection in the persistent shell and page payload.
export const readPublicServerContent = cache(async () =>
  publicContent((await readServerContent()).data),
);
