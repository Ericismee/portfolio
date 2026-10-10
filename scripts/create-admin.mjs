import path from 'node:path';
import {createInterface} from 'node:readline/promises';
import {openDatabase} from '../backend/database.mjs';
import {passwordHash} from '../backend/auth.mjs';
const username=process.argv[2]||'admin';
if(!/^[a-zA-Z0-9_-]{3,40}$/.test(username))throw Error('Username must contain 3–40 letters, digits, underscores or hyphens');
let password=process.env.ADMIN_PASSWORD;
if(!password){const rl=createInterface({input:process.stdin,output:process.stdout});console.log('Password input is visible in this terminal. Prefer ADMIN_PASSWORD from your secret manager.');password=await rl.question('Password (12–256 characters): ');rl.close()}
const hash=await passwordHash(password),{db}=openDatabase(process.env.DATA_DIR||path.resolve('.data'));
db.prepare('INSERT INTO admins VALUES(?,?) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash').run(username,hash);
db.prepare('DELETE FROM sessions WHERE username=?').run(username);db.close();console.log('Administrator created or password updated: '+username);
