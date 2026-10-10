import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const pages=await(await fetch('http://127.0.0.1:9222/json')).json();
const page=pages.find(p=>p.type==='page'&&p.url.includes(':3001'));
assert(page,'Open the isolated Chrome preview on port 9222 first.');
const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let sequence=0;const pending=new Map,errors=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}};
const call=(method,params={})=>new Promise(r=>{const id=++sequence;pending.set(id,r);ws.send(JSON.stringify({id,method,params}))});
const evaluate=async expression=>{const m=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!m.result.exceptionDetails,JSON.stringify(m.result.exceptionDetails));return m.result.result.value};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const go=async hash=>{await evaluate(`location.hash=${JSON.stringify(hash)}`);await pause(200)};
const check=async(name,expression)=>{assert.equal(await evaluate(expression),true,name);console.log('PASS',name)};
const shot=async name=>{const m=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(name,Buffer.from(m.result.data,'base64'))};
try{
  await call('Runtime.enable');await call('Page.enable');
  await evaluate(`localStorage.removeItem('eric-profile-mock');localStorage.removeItem('eric-owner');location.hash='profile';location.reload()`);await pause(400);
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('[data-action=edit-profile]').focus();document.querySelector('[data-action=edit-profile]').click()`);
  await check('Editor focuses first field',`document.activeElement.matches('input')`);
  await evaluate(`document.querySelector('[name=name]').value='Unsaved name';document.querySelector('[name=name]').dispatchEvent(new Event('input',{bubbles:true}));`);
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await pause(100);await check('Escape warns before discarding',`document.querySelector('#dialog').open&&!!document.querySelector('[data-discard-editor]')`);
  await evaluate(`document.querySelector('[data-discard-editor]').click()`);await pause(100);
  await check('Discard preserves profile and returns focus',`document.querySelector('h1').textContent==='Eric'&&document.activeElement.dataset.action==='edit-profile'`);
  await evaluate(`document.querySelector('[data-action=toggle-owner]').click()`);
  await check('Guest hides empty sections and editor controls',`![...document.querySelectorAll('.main h2')].some(h=>['Giới thiệu','Kinh nghiệm','Học vấn','Chứng chỉ'].includes(h.textContent))&&!document.querySelector('[data-action=edit-profile]')`);
  await shot('qa-guest-mobile.png');await go('feed');
  await check('Guest hides composer card',`!document.querySelector('[data-action=compose]')`);
  await evaluate(`document.querySelector('[data-action=toggle-owner]').click()`);await go('projects');
  await evaluate(`document.querySelector('.mobile-filter-toggle').click()`);
  await check('Mobile filter expands accessibly',`document.querySelector('.mobile-filter-toggle').getAttribute('aria-expanded')==='true'&&getComputedStyle(document.querySelector('#tech-filter')).display!=='none'`);
  await evaluate(`document.querySelector('#project-search').value='nomatch';document.querySelector('#project-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  await check('Empty results offer reset',`document.querySelectorAll('.project').length===0&&!!document.querySelector('[data-action=reset-filters]')`);
  await evaluate(`document.querySelector('[data-action=reset-filters]').click()`);
  await check('Reset restores project results',`document.querySelectorAll('.project').length===3&&location.hash==='#projects'`);
  await go('contact');
  await check('Required fields reject blank submission',`!document.querySelector('#contact-form').checkValidity()`);
  await evaluate(`document.querySelector('[name=name]').value='Tester';document.querySelector('[name=email]').value='tester@example.com';document.querySelector('[name=subject]').value='Demo';document.querySelector('[name=message]').value='Test a mock contact message';document.querySelector('[name=scenario]').value='error';document.querySelector('#contact-form').requestSubmit()`);
  await check('Contact shows loading and disables submit',`document.querySelector('#contact-form').getAttribute('aria-busy')==='true'&&document.querySelector('#contact-form [type=submit]').disabled`);
  await pause(750);
  await check('Error retains message for retry',`document.querySelector('#contact-result').dataset.state==='error'&&document.querySelector('[name=message]').value==='Test a mock contact message'`);
  await shot('qa-contact-error-mobile.png');
  await evaluate(`document.querySelector('[name=scenario]').value='success';document.querySelector('#contact-form').requestSubmit()`);await pause(750);
  await check('Retry succeeds with honest mock status',`document.querySelector('#contact-result').dataset.state==='success'&&document.querySelector('#contact-result').textContent.includes('chưa được gửi')&&!document.querySelector('[name=message]').value`);
  await go('profile');await evaluate(`document.querySelector('[data-action=account]').click()`);
  await check('Account menu opens',`!!document.querySelector('.menu [data-route=settings]')`);
  await evaluate(`document.querySelector('.menu [data-route=settings]').click()`);await pause(200);
  await check('Menu navigates to settings and closes',`location.hash==='#settings'&&!document.querySelector('.menu')`);
  await go('projects');await shot('qa-projects-mobile.png');
  await evaluate(`document.querySelector('.project-open').click()`);await pause(200);
  await check('Project card opens its detail',`location.hash.startsWith('#projects/')&&!!document.querySelector('#view h1')`);
  await go('projects');await evaluate(`document.querySelector('[data-action=list-toggle]').click()`);
  await check('Mobile list keeps a readable single column',`getComputedStyle(document.querySelector('.project')).flexDirection==='column'&&document.documentElement.scrollWidth<=innerWidth`);
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await go('projects');await shot('qa-projects-desktop.png');
  await go('settings');await evaluate(`document.querySelector('#theme-select').value='dark';document.querySelector('#theme-select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await go('projects');await shot('qa-projects-dark.png');
  await check('Dark project cards use the dark palette',`document.documentElement.dataset.theme==='dark'&&getComputedStyle(document.querySelector('.project-art')).color==='rgb(245, 241, 232)'`);
  await go('settings');await evaluate(`document.querySelector('#theme-select').value='light';document.querySelector('#theme-select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await go('profile');
  await check('Profile suggestions open the real editor',`!!document.querySelector('.profile-hint [data-action=edit-about]')`);
  await evaluate(`document.querySelector('.profile-hint [data-action=edit-about]').click();document.querySelector('[name=about]').value='A meaningful profile introduction for the UI preview.';document.querySelector('#modal-form').requestSubmit()`);
  await check('Completed suggestion advances to remaining fields',`!document.querySelector('.profile-hint [data-action=edit-about]')&&!!document.querySelector('.profile-hint [data-action=upload-avatar]')`);
  await evaluate(`document.querySelector('[data-action=edit-profile]').click();document.querySelector('[name=name]').value='LongName'.repeat(20);document.querySelector('[name=headline]').value='Headline'.repeat(35);document.querySelector('#modal-form').requestSubmit()`);
  for(const width of [360,390,768,1024,1440]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    for(const route of ['profile','feed','projects','github','contact','settings']){
      await go(route);await check(`${route} no overflow at ${width}`,`document.documentElement.scrollWidth<=innerWidth`);
    }
    await go('profile');await evaluate(`document.querySelector('[data-action=edit-profile]').focus();document.querySelector('[data-action=edit-profile]').click()`);
    await check(`Editor fits at ${width}`,`(()=>{const r=document.querySelector('#dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()`);
    await evaluate(`document.querySelector('[data-close-editor]').click()`);
  }
  await go('profile');await evaluate(`document.querySelector('.logo').focus()`);
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await check('Keyboard search has visible focus',`document.activeElement.id==='global-search'&&parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=2`);
  await evaluate(`document.querySelector('[data-action=edit-profile]').focus();document.querySelector('[data-action=edit-profile]').click();document.querySelector('[name=name]').value='Profile QA';document.querySelector('#modal-form').requestSubmit();location.reload()`);await pause(300);
  await check('Saved edits survive reload',`document.querySelector('h1').textContent==='Profile QA'`);
  assert.deepEqual(errors,[],'No browser runtime exceptions');console.log('PASS No browser runtime exceptions');
}finally{
  await evaluate(`localStorage.removeItem('eric-profile-mock');localStorage.removeItem('eric-owner');location.hash='profile';location.reload()`);ws.close();
}




