import { cache } from 'react';
import { getDatabase } from './database';

// Deduplicate layout, metadata and page reads within one render only.
// Fresh requests still read the current publication state.
export const readServerContent = cache(async () => (await getDatabase()).read());
