import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { get, del } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { HttpError, type Database } from './database.ts';
import { MAX_UPLOAD_BYTES } from './upload-limits.ts';

const mimeExtensions: Record<string,string> = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/gif':'gif', 'application/pdf':'pdf', 'application/json':'json' };
export const blobServices = { get, del, generateToken:generateClientTokenFromReadWriteToken };
export const intentInput = z.object({ mime: z.enum(['image/png','image/jpeg','image/webp','image/gif','application/pdf','application/json']), size:z.number().int().positive().max(MAX_UPLOAD_BYTES) });
export async function startCloudUpload(database: Database, username: string, input: unknown, services=blobServices) {
  const {mime, size} = intentInput.parse(input);
  const id = randomUUID() + '.' + mimeExtensions[mime];
  const expires = Date.now() + 10 * 60_000;
  await database.db.prepare('INSERT INTO upload_intents VALUES(?,?,?,?,?)').run(id, username, mime, size, expires);
  const token = await services.generateToken({ pathname:'pending/' + id, allowedContentTypes:[mime], maximumSizeInBytes:size, validUntil:expires, addRandomSuffix:false, allowOverwrite:false });
  return { mode:'cloud', id, token, pathname:'pending/' + id };
}
// Callers cannot provide a remote URL. Only a server-created, owned intent can be read.
export async function consumeCloudUpload(database: Database, username: string, id: string, services=blobServices) {
  if (!/^[a-f0-9-]{36}\.(png|jpg|webp|gif|pdf|json)$/.test(id)) throw new HttpError(400,'Invalid upload');
  const intent = await database.db.prepare('DELETE FROM upload_intents WHERE id=? AND username=? AND expires>? RETURNING mime,size').get(id,username,Date.now()) as {mime:string;size:number}|undefined;
  if (!intent) throw new HttpError(404,'Upload expired or not found / File đã hết hạn hoặc không tồn tại');
  try {
    const result = await services.get('pending/' + id, {access:'private', useCache:false});
    if (!result || result.statusCode !== 200) throw new HttpError(400,'Upload not complete');
    if (result.blob.size !== intent.size || result.blob.size > MAX_UPLOAD_BYTES || result.blob.contentType !== intent.mime) {
      await result.stream.cancel();
      throw new HttpError(400,'Uploaded file does not match its authorization');
    }
    const reader = result.stream.getReader();
    const chunks:Uint8Array[]=[]; let total=0;
    while(true) { const {done,value}=await reader.read(); if(done) break; total+=value.byteLength; if(total>intent.size) {await reader.cancel();throw new HttpError(413,'File too large');} chunks.push(value); }
    if(total!==intent.size) throw new HttpError(400,'Incomplete upload');
    return {bytes:Buffer.concat(chunks),mime:intent.mime};
  } finally {
    await services.del('pending/' + id).catch(()=>undefined);
  }
}
