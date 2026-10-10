import {initial,skills} from '../src/data.js';
export function seedContent(){const d=structuredClone(initial);d.skills=[...skills];d.posts=d.posts.map(p=>({...p,visibility:'draft'}));d.sectionTitles={};d.layout='standard';d.trash=[];return d}
const badKeys=new Set(['__proto__','constructor','prototype']);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function text(v,max=10000){if(v==null)return '';if(typeof v!=='string'||v.length>max)throw Error('Invalid text / Nội dung quá dài');return v.trim()}
function list(v,max){if(!Array.isArray(v)||v.length>max)throw Error('Invalid list / Danh sách không hợp lệ');return v}
function url(v){const s=text(v,2048);if(!s)return '';if(/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp|gif|pdf)$/.test(s))return s;const u=new URL(s);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid URL');return s}
const names=v=>list(v,60).map(x=>{const s=text(x,100);if(!s||badKeys.has(s))throw Error('Invalid section');return s});
function entry(v,kind){
  if(!object(v))throw Error('Invalid content');const out={};
  const fields=kind==='projects'?['id','name','description','tech','status','role','problem','contribution','outcome','details']:kind==='posts'?['id','title','text','type']:['id','title','organization','period','description'];
  for(const k of fields)out[k]=text(v[k],['text','details','description','problem','contribution','outcome'].includes(k)?30000:200);
  if(!out.id||!(out.name||out.title))throw Error('Title is required / Cần nhập tiêu đề');
  out.visible=v.visible!==false;out.visibility=v.visibility==='draft'?'draft':'public';
  if(kind==='projects'){for(const k of ['github','demo','source','thumbnail'])out[k]=url(v[k]);out.pinned=v.pinned===true;out.sample=v.sample===true;out.technologies=Array.isArray(v.technologies)?v.technologies.slice(0,30).map(s=>text(s,100)):[]}
  if(kind==='posts'){out.link=url(v.link);out.image=url(v.image);out.sample=v.sample===true;for(const k of ['createdAt','displayAt']){if(v[k]){const date=new Date(v[k]);if(!Number.isFinite(date.valueOf()))throw Error('Invalid date');out[k]=date.toISOString()}}}
  return out;
}
export function validateContent(v){
  if(!object(v)||!object(v.profile))throw Error('Invalid profile');
  const d={profile:{},theme:v.theme==='dark'?'dark':'light',accent:text(v.accent,7),density:v.density==='compact'?'compact':'comfortable',layout:v.layout==='wide'?'wide':'standard',contentVersion:1,visualStyle:'colorful-template'};
  if(!/^#[a-f0-9]{6}$/i.test(d.accent))throw Error('Invalid accent');
  for(const k of ['name','headline','summary','location','about'])d.profile[k]=text(v.profile[k],k==='about'?20000:200);
  if(!d.profile.name)throw Error('Name is required');for(const k of ['avatar','cover'])d.profile[k]=url(v.profile[k]);
  d.sections=names(v.sections);if(new Set(d.sections).size!==d.sections.length)throw Error('Duplicate sections');
  d.hidden=names(v.hidden||[]).filter(s=>d.sections.includes(s));d.sectionTitles={};d.items={};
  for(const section of d.sections){d.sectionTitles[section]=text(v.sectionTitles?.[section]||section,100);d.items[section]=list(v.items?.[section]||[],200).map(e=>entry(e,'items'))}
  d.projects=list(v.projects,300).map(e=>entry(e,'projects'));d.posts=list(v.posts,500).map(e=>entry(e,'posts'));
  for(const group of [d.projects,d.posts,...Object.values(d.items)])if(new Set(group.map(x=>x.id)).size!==group.length)throw Error('Duplicate IDs');
  d.skills=names(v.skills||[]);d.links={};
  for(const [k,value]of Object.entries(v.links||{})){if(!/^[a-zA-Z0-9_-]{1,40}$/.test(k)||badKeys.has(k))throw Error('Invalid link name');d.links[k]=k==='email'?text(value,254):url(value);if(k==='email'&&d.links[k]&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.links[k]))throw Error('Invalid email')}
  d.githubUsername=text(v.githubUsername,39);if(d.githubUsername&&!/^[a-zA-Z0-9-]+$/.test(d.githubUsername))throw Error('Invalid GitHub username');
  if(v.cv)d.cv={name:text(v.cv.name,200),url:url(v.cv.url)};
  d.trash=list(v.trash||[],100).map(r=>{if(!['projects','posts','items'].includes(r.kind))throw Error('Invalid trash');return {id:text(r.id,200),kind:r.kind,section:text(r.section,100),deletedAt:text(r.deletedAt,100),value:entry(r.value,r.kind)}});
  return d;
}
export function publicContent(content,now=Date.now()){
  const d=structuredClone(content);delete d.trash;
  const published=e=>e.visible!==false&&e.visibility!=='draft'&&e.status!=='Bản nháp'&&(!e.displayAt||new Date(e.displayAt).valueOf()<=now);
  d.projects=d.projects.filter(published);d.posts=d.posts.filter(published);
  for(const key of Object.keys(d.items)){if(d.hidden.includes(key))delete d.items[key];else d.items[key]=d.items[key].filter(published)}
  if(d.hidden.includes('Giới thiệu'))d.profile.about='';return d;
}
