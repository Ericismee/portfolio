import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {openDatabase} from './backend/database.mjs';
import {authService,verifyPassword,passwordHash} from './backend/auth.mjs';
import {publicContent} from './backend/content.mjs';
import {storeUpload,readUpload,migrateAssets} from './backend/uploads.mjs';

export async function createServer({directory=process.env.DATA_DIR||path.resolve('.data'),production=process.env.NODE_ENV==='production',origin=process.env.PUBLIC_ORIGIN}={}){
  if(production&&!origin)throw Error('PUBLIC_ORIGIN is required in production');
  const database=openDatabase(directory),{db}=database,auth=authService(db,production),limits=new Map();
  const dummy=await passwordHash('unused-timing-comparison-password');
  const rate=(req,key,max)=>{const k=key+':'+req.socket.remoteAddress,now=Date.now();let r=limits.get(k);if(!r||r.until<now){r={until:now+900000,count:0};limits.set(k,r)}if(limits.size>10000)for(const [id,v]of limits)if(v.until<now)limits.delete(id);if(++r.count>max)throw Object.assign(Error('Too many requests / Vui lòng thử lại sau'),{status:429})};
  async function bytes(req,max=8e6){const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>max)throw Object.assign(Error('File or content too large / Dữ liệu quá lớn'),{status:413});chunks.push(chunk)}return Buffer.concat(chunks)}
  async function json(req){try{return JSON.parse((await bytes(req)).toString())}catch(e){if(e.status)throw e;throw Object.assign(Error('Invalid JSON'),{status:400})}}
  const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
    try{
      const pathname=new URL(req.url,'http://localhost').pathname,method=req.method;
      if(pathname.startsWith('/api/')){
        const session=auth.session(req);
        if(!['GET','HEAD'].includes(method)){
          const expected=origin||`http://${req.headers.host}`;
          if(req.headers.origin!==expected)throw Object.assign(Error('Invalid origin'),{status:403});
          if(pathname.startsWith('/api/admin/')&&(!session||req.headers['x-csrf-token']!==session.csrf))throw Object.assign(Error('Invalid session or CSRF token'),{status:403});
        }
        if(pathname==='/api/content'&&method==='GET')return send(res,200,{data:publicContent(database.read().data)});
        if(pathname==='/api/session'&&method==='GET')return send(res,200,{authenticated:!!session,csrf:session?.csrf});
        if(pathname==='/api/login'&&method==='POST'){
          rate(req,'login',20);const body=await json(req),user=typeof body.username==='string'?db.prepare('SELECT * FROM admins WHERE username=?').get(body.username):null;
          const valid=await verifyPassword(body.password,user?.password_hash||dummy);
          if(!user||!valid)return send(res,401,{error:'Incorrect username or password / Tên đăng nhập hoặc mật khẩu không đúng'});
          const login=auth.create(user.username);res.setHeader('Set-Cookie',login.cookie);return send(res,200,{authenticated:true,csrf:login.csrf});
        }
        if(pathname==='/api/contact'&&method==='POST'){
          rate(req,'contact',10);const b=await json(req);
          if(typeof b.name!=='string'||!b.name.trim()||b.name.length>200||typeof b.email!=='string'||b.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||typeof b.subject!=='string'||!b.subject.trim()||b.subject.length>200||typeof b.message!=='string'||b.message.trim().length<10||b.message.length>10000)throw Object.assign(Error('Please check your name, email and message / Kiểm tra họ tên, email và nội dung'),{status:400});
          db.prepare('INSERT INTO messages(name,email,subject,message,created_at) VALUES(?,?,?,?,?)').run(b.name.trim(),b.email.trim(),b.subject.trim(),b.message.trim(),new Date().toISOString());return send(res,201,{saved:true});
        }
        if(pathname.startsWith('/api/admin/')){
          if(!session)return send(res,401,{error:'Please sign in / Vui lòng đăng nhập'});
          if(pathname==='/api/admin/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);res.setHeader('Set-Cookie',auth.cookie('',0));return send(res,200,{ok:true})}
          if(pathname==='/api/admin/content'&&method==='GET')return send(res,200,database.read());
          if(pathname==='/api/admin/content'&&method==='PUT'){const b=await json(req);return send(res,200,database.write(b.data,b.version))}
          if(pathname==='/api/admin/import'&&method==='POST'){const b=await json(req);return send(res,200,database.write(await migrateAssets(b.data,directory),b.version))}
          if(pathname==='/api/admin/upload'&&method==='POST'){const url=await storeUpload(directory,await bytes(req,3e6),req.headers['content-type']);return send(res,201,{url})}
          if(pathname==='/api/admin/revisions'&&method==='GET')return send(res,200,{revisions:db.prepare('SELECT id,created_at FROM revisions ORDER BY id DESC').all()});
          if(pathname==='/api/admin/restore'&&method==='POST'){const b=await json(req),r=db.prepare('SELECT body FROM revisions WHERE id=?').get(b.id);if(!r)return send(res,404,{error:'Revision not found'});return send(res,200,database.write(JSON.parse(r.body),b.version))}
          if(pathname==='/api/admin/messages'&&method==='GET')return send(res,200,{messages:db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all()});
          if(pathname==='/api/admin/messages'&&method==='DELETE'){const b=await json(req);db.prepare('DELETE FROM messages WHERE id=?').run(b.id);return send(res,200,{ok:true})}
        }
        return send(res,404,{error:'Not found'});
      }
      if(method!=='GET'&&method!=='HEAD'){res.writeHead(405);return res.end()}
      let body,type;
      if(/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp|gif|pdf)$/.test(pathname)){
        body=await readUpload(directory,pathname.slice(9));type=({'png':'image/png','jpg':'image/jpeg','webp':'image/webp','gif':'image/gif','pdf':'application/pdf'})[pathname.split('.').pop()];res.setHeader('Cache-Control','private, max-age=3600');
      }else{
        const file=pathname==='/admin'||pathname==='/admin/'?'/admin.html':pathname==='/'?'/index.html':pathname;
        if(!['/index.html','/admin.html'].includes(file)&&!/^\/src\/[a-zA-Z0-9_./-]+\.(js|css|woff2)$/.test(file))throw Error('Not found');
        const target=path.resolve(import.meta.dirname,'.'+file);if(!target.startsWith(import.meta.dirname+path.sep))throw Error('Not found');body=await readFile(target);type=({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[path.extname(file)];res.setHeader('Cache-Control','no-cache');
      }
      res.setHeader('Content-Type',type);res.writeHead(200);res.end(method==='HEAD'?undefined:body);
    }catch(e){const status=e.status||(e.code==='ENOENT'||e.message==='Not found'?404:400);send(res,status,{error:status===500?'Server error':e.message})}
  });
  server.on('close',()=>db.close());return {server,database};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const {server}=await createServer();server.listen(Number(process.env.PORT||3001),process.env.HOST||'127.0.0.1',()=>console.log('Profile server listening on port '+(process.env.PORT||3001)))}

