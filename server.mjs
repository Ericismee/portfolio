import { pathToFileURL } from 'node:url';
// Retired compatibility entrypoint: use the Next.js API with current privacy rules.
export async function createServer() {
  throw new Error(
    'The legacy server has been retired. Use npm run dev or npm start with Node.js 24.',
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.error(
    'The legacy server has been retired. Use npm run dev or npm start with Node.js 24.',
  );
  process.exitCode = 1;
}
