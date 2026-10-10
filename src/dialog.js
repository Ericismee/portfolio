export function openEditor(title,body,onSave,{refresh,persist}){
  const d=document.querySelector('#dialog'),opener=document.activeElement;
  const identity={action:opener?.dataset.action,id:opener?.dataset.id,section:opener?.dataset.section};
  d.innerHTML=`<form method="dialog" id="modal-form"><div class="dialog-head"><h2 id="dialog-title">${title}</h2><button class="icon-btn" type="button" data-close-editor aria-label="Đóng">×</button></div><div class="dialog-body">${body}<div class="dialog-actions"><button class="btn neutral" type="button" data-close-editor>Hủy</button><button class="btn primary" type="submit">Lưu trong bản demo</button></div></div></form>`;
  d.setAttribute('aria-labelledby','dialog-title');d.setAttribute('aria-modal','true');
  let dirty=false;
  function returnFocus(){if(opener?.isConnected){opener.focus();return}const candidates=[...document.querySelectorAll('[data-action]')];const target=candidates.find(e=>e.dataset.action===identity.action&&(!identity.id||e.dataset.id===identity.id)&&(!identity.section||e.dataset.section===identity.section));(target||document.querySelector('#view'))?.focus()}
  function requestClose(){if(!dirty){d.close();return}if(d.querySelector('.discard-notice'))return;const notice=document.createElement('div');notice.className='notice discard-notice';notice.setAttribute('role','status');notice.innerHTML='<span>Có thay đổi chưa lưu.</span><button type="button" class="btn neutral" data-discard-editor>Bỏ thay đổi</button>';notice.querySelector('button').onclick=()=>d.close();d.querySelector('.dialog-body').prepend(notice);notice.querySelector('button').focus()}
  d.onclose=returnFocus;d.oncancel=e=>{e.preventDefault();requestClose()};
  d.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();requestClose()}};
  d.querySelectorAll('[data-close-editor]').forEach(b=>b.onclick=requestClose);
  d.querySelector('form').addEventListener('input',()=>dirty=true);
  d.querySelector('form').addEventListener('change',()=>dirty=true);
  d.querySelector('form').onsubmit=e=>{e.preventDefault();const fields=Object.fromEntries([...new FormData(e.currentTarget)].filter(([,v])=>typeof v==='string'));onSave(fields);dirty=false;d.close();refresh();persist();returnFocus()};
  d.showModal();(d.querySelector('input:not([type=hidden]),textarea,select')||d.querySelector('[data-close-editor]'))?.focus();
}
