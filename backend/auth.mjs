import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const token=()=>randomBytes(32).toString('hex');
export const digest=s=>createHash('sha256').update(s).digest('hex');
export async function passwordHash(password){if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Password must have 12–256 characters');const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return salt+':'+hash.toString('hex')}
export async function verifyPassword(password,stored){if(typeof password!=='string'||password.length>256)return false;const [salt,hash]=stored.split(':');const actual=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return timingSafeEqual(Buffer.from(hash,'hex'),actual)}
export function authService(db,production){
  const cookieName=production?'__Host-profile_session':'profile_session';
  const cookie=(value,maxAge)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production?'; Secure':''}`;
  function session(req){const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;return db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires>?').get(digest(raw),Date.now())||null}
  function create(username){db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());const value=token(),csrf=token();db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(value),username,csrf,Date.now()+12*60*60*1000);return {cookie:cookie(value,43200),csrf}}
  return {session,create,cookie};
}
