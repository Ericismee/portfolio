import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {seedContent,validateContent} from './content.mjs';
export function openDatabase(directory){
  mkdirSync(directory,{recursive:true,mode:0o700});const db=new DatabaseSync(path.join(directory,'profile.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS content(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admins(username TEXT PRIMARY KEY,password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,username TEXT NOT NULL REFERENCES admins(username),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY AUTOINCREMENT,body TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL);
    INSERT OR IGNORE INTO migrations VALUES(1);`);
  db.prepare('INSERT OR IGNORE INTO content VALUES(1,1,?)').run(JSON.stringify(validateContent(seedContent())));
  const read=()=>{const r=db.prepare('SELECT version,body FROM content WHERE id=1').get();return {version:r.version,data:JSON.parse(r.body)}};
  function write(data,version){const next=validateContent(data);db.exec('BEGIN IMMEDIATE');try{
    const prev=read();if(prev.version!==version){const e=Error('Content changed in another window / Nội dung đã thay đổi ở cửa sổ khác');e.status=409;throw e}
    db.prepare('INSERT INTO revisions(body,created_at) VALUES(?,?)').run(JSON.stringify(prev.data),new Date().toISOString());
    db.prepare('UPDATE content SET version=version+1,body=? WHERE id=1').run(JSON.stringify(next));
    db.exec('DELETE FROM revisions WHERE id NOT IN (SELECT id FROM revisions ORDER BY id DESC LIMIT 30)');db.exec('COMMIT');return read();
  }catch(e){db.exec('ROLLBACK');throw e}}
  return {db,read,write};
}
