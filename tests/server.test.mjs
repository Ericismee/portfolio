import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from '../server.mjs';
import {passwordHash} from '../backend/auth.mjs';
test('Authentication, authorization, content lifecycle and persistence',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'profile-test-'));let instance=await createServer({directory});
 const start=async()=>{await new Promise(r=>instance.server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+instance.server.address().port};
 let base=await start(),cookie='',csrf='';
 const request=async(url,method='GET',data,headers={})=>{const r=await fetch(base+url,{method,headers:{Origin:base,Cookie:cookie,'x-csrf-token':csrf,'Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data)});return {r,body:await r.json()}};
 try{
  instance.database.db.prepare('INSERT INTO admins VALUES(?,?)').run('admin',await passwordHash('test-password-never-production'));
  assert.equal((await request('/api/admin/content')).r.status,401);
  assert.equal((await request('/api/admin/content','PUT',{})).r.status,403);
  assert.equal((await request('/.data/profile.sqlite')).r.status,404);
  assert.equal((await request('/api/login','POST',{username:'admin',password:'incorrect'})).r.status,401);
  const login=await request('/api/login','POST',{username:'admin',password:'test-password-never-production'});assert.equal(login.r.status,200);cookie=login.r.headers.get('set-cookie').split(';')[0];csrf=login.body.csrf;
  let {body:state}=await request('/api/admin/content');const data=state.data;
  data.posts=[{id:'draft',title:'Secret draft',text:'Private text',type:'Bài viết',visibility:'draft'},{id:'published',title:'Published',text:'Public text',type:'Bài viết',visibility:'public',displayAt:new Date().toISOString()},{id:'scheduled',title:'Future',text:'Not yet',type:'Bài viết',displayAt:'2099-01-01T00:00:00Z'}];
  assert.equal((await request('/api/admin/content','PUT',{data,version:state.version},{'x-csrf-token':'bad'})).r.status,403);
  assert.equal((await request('/api/admin/content','PUT',{data,version:state.version},{Origin:'https://attacker.test'})).r.status,403);
  let result=await request('/api/admin/content','PUT',{data,version:state.version});assert.equal(result.r.status,200);state=result.body;
  assert.equal((await request('/api/admin/content','PUT',{data,version:1})).r.status,409);
  const publicView=(await request('/api/content')).body.data;assert.deepEqual(publicView.posts.map(p=>p.id),['published']);assert.equal(publicView.trash,undefined);
  data.posts[0].visibility='public';data.posts[1].visible=false;data.projects.reverse();data.hidden.push('Giới thiệu');data.sectionTitles['Dự án']='Selected work';
  state=(await request('/api/admin/content','PUT',{data,version:state.version})).body;
  const visible=(await request('/api/content')).body.data;assert.deepEqual(visible.posts.map(p=>p.id),['draft']);assert.equal(visible.profile.about,'');assert.equal(visible.sectionTitles['Dự án'],'Selected work');
  const invalid=structuredClone(data);invalid.profile.avatar='javascript:alert(1)';assert.equal((await request('/api/admin/content','PUT',{data:invalid,version:state.version})).r.status,400);
  const invalidFile=await fetch(base+'/api/admin/upload',{method:'POST',headers:{Origin:base,Cookie:cookie,'x-csrf-token':csrf,'Content-Type':'image/png'},body:'not PNG'});assert.equal(invalidFile.status,400);
  assert.equal((await request('/api/contact','POST',{name:'Visitor',email:'visitor@example.com',subject:'Hello',message:'A real message to the owner'})).r.status,201);assert.equal((await request('/api/admin/messages')).body.messages.length,1);
  const revisions=(await request('/api/admin/revisions')).body.revisions;assert.equal(revisions.length,2);
  state=(await request('/api/admin/restore','POST',{id:revisions[0].id,version:state.version})).body;assert.equal(state.data.posts[0].visibility,'draft');
  await new Promise(r=>instance.server.close(r));instance=await createServer({directory});base=await start();assert.equal((await request('/api/admin/content')).body.version,state.version);
  assert.equal((await request('/api/admin/logout','POST',{})).r.status,200);assert.equal((await request('/api/admin/content')).r.status,401);
 }finally{await new Promise(r=>instance.server.close(r));await rm(directory,{recursive:true,force:true})}
});
