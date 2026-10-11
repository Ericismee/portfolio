import { MAX_UPLOAD_BYTES } from './upload-limits.ts';
import { put } from '@vercel/blob/client';
async function jsonPost(url:string, body:unknown, csrf:string) {
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':csrf},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
  const result=await response.json();
  if(!response.ok) throw Error(result.error || 'Upload failed');
  return result;
}
async function directUpload(file:Blob,mime:string,csrf:string):Promise<string|null> {
  if(file.size>MAX_UPLOAD_BYTES) throw Error('File up to 20 MB / File tối đa 20 MB');
  const intent=await jsonPost('/api/admin/upload-init',{mime,size:file.size},csrf);
  if(intent.mode==='local') return null;
  await put(intent.pathname,file,{access:'private',token:intent.token,contentType:mime,multipart:file.size>4*1024*1024,abortSignal:AbortSignal.timeout(120000)});
  return intent.id;
}
export async function uploadFile(file:File,mime:string,csrf:string):Promise<string> {
  const id=await directUpload(file,mime,csrf);
  if(id) return (await jsonPost('/api/admin/upload-finish',{id},csrf)).url;
  const response=await fetch('/api/admin/upload',{method:'POST',headers:{'Content-Type':mime,'x-csrf-token':csrf},body:file,signal:AbortSignal.timeout(60000)});
  const result=await response.json(); if(!response.ok) throw Error(result.error); return result.url;
}
export async function importContent(data:unknown,version:number,csrf:string) {
  const id=await directUpload(new Blob([JSON.stringify(data)],{type:'application/json'}),'application/json',csrf);
  return id ? jsonPost('/api/admin/import-blob',{id,version},csrf) : jsonPost('/api/admin/import',{data,version},csrf);
}
export async function uploadMime(file: File): Promise<string> {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (file.size > MAX_UPLOAD_BYTES)
    throw Error(
      pdf ? 'PDF tối đa 20 MB / PDF up to 20 MB' : 'Ảnh tối đa 20 MB / Images up to 20 MB',
    );
  if (pdf) {
    const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (signature !== '%PDF-') throw Error('File PDF không hợp lệ / Invalid PDF file');
    return 'application/pdf';
  }
  return file.type;
}
