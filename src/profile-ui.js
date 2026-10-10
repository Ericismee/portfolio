import {esc,svg} from './ui.js';

export function monogram(name){
  const words=String(name||'').trim().split(/\s+/).filter(Boolean);
  return (words.length>1?words.slice(0,2).map(w=>Array.from(w)[0]).join(''):Array.from(words[0]||'?').slice(0,2).join('')).toLocaleUpperCase('vi');
}

export function profileHint(data){
  const suggestions=[
    !data.profile.about?.trim()&&['Viết giới thiệu','edit-about'],
    !data.profile.avatar&&['Thêm ảnh đại diện','upload-avatar'],
    !data.profile.cover&&['Thêm ảnh bìa','upload-cover'],
    !Object.values(data.links||{}).some(Boolean)&&['Thêm liên kết','edit-links'],
  ].filter(Boolean);
  if(!suggestions.length)return '';
  const [label,action]=suggestions[0];
  return `<details class="profile-hint"><summary>Hoàn thiện hồ sơ <span class="muted">Gợi ý cho bạn</span></summary><div class="hint-content"><p>Chỉ thêm thông tin bạn muốn công khai.</p><button class="btn neutral" data-action="${action}">${label}</button></div></details>`;
}

export function projectOverview(projects,featured){
  const others=projects.filter(p=>!featured.some(f=>f.id===p.id));
  return `<div class="project-overview"><p class="muted">${projects.length} dự án trong hồ sơ${featured.length?' · Dự án được chọn nằm ở mục Nổi bật.':'.'}</p>${others.slice(0,3).map(p=>`<a class="project-summary-link" href="#projects/${encodeURIComponent(p.id)}"><span><strong>${esc(p.name)}</strong><small>${esc(p.tech||'Dự án')}${p.visibility==='draft'?' · Bản nháp':''}</small></span><span aria-hidden="true">↗</span></a>`).join('')}<a class="btn neutral all-projects" href="#projects">Xem tất cả ${projects.length} dự án <span aria-hidden="true">→</span></a></div>`;
}

export function renderProjectCard(project,owner){
  const tone=['blue','lavender','mint','peach'][Array.from(project.id||project.name).reduce((sum,c)=>sum+c.codePointAt(0),0)%4];
  const href='#projects/'+encodeURIComponent(project.id);
  return `<article class="project" data-tone="${tone}">
    <a class="project-art" href="${href}" aria-label="Xem dự án ${esc(project.name)}">${project.thumbnail?`<img src="${esc(project.thumbnail)}" alt="Ảnh dự án ${esc(project.name)}" loading="lazy">`:`<span class="project-monogram" aria-hidden="true">${esc(monogram(project.name))}</span><span class="project-art-label">${esc(project.tech||'Dự án')}</span>`}</a>
    <div class="project-content"><div class="row between"><h3><a href="${href}">${esc(project.name)}</a></h3>${owner?`<button class="icon-btn" aria-label="Sửa dự án ${esc(project.name)}" data-action="edit-project" data-id="${esc(project.id)}">${svg('edit')}</button>`:''}</div>
    <span class="badge">${project.visibility==='draft'?'Bản nháp':esc(project.status||'Dự án')}</span>
    <p class="muted project-description">${esc(project.description||'Chưa thêm mô tả dự án.')}</p>
    ${project.role?`<p class="project-role"><span>Vai trò</span> ${esc(project.role)}</p>`:''}
    ${project.contribution?`<p class="project-contribution"><strong>Đóng góp</strong> ${esc(project.contribution)}</p>`:''}
    <div class="project-card-footer">${project.tech?`<span class="tag">${esc(project.tech)}</span>`:''}<a class="project-open" href="${href}">Xem dự án <span aria-hidden="true">↗</span></a></div></div>
  </article>`;
}
