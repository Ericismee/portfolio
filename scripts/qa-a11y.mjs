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
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate("localStorage.removeItem('eric-profile-mock');localStorage.removeItem('eric-owner');location.hash='profile';location.reload()");await pause(400);
  for(const theme of ['light','dark']){
    await go('settings');await evaluate("document.querySelector('#theme-select').value="+JSON.stringify(theme)+";document.querySelector('#theme-select').dispatchEvent(new Event('change',{bubbles:true}))");await go('profile');
    for(const accent of ['#4264da','#ffffff','#000000','#ffff00','#808080','#ff0000','#00ff00']){
      await evaluate("import('/src/theme.js').then(m=>m.applyTheme("+JSON.stringify(accent)+","+JSON.stringify(theme)+"))");
      await pause(180);const ratios=await evaluate(`(()=>{
        const rgb=s=>(s.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
        const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
        const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
        return ['.profile-body .btn.primary','.profile-body .btn.neutral','.profile-identity a'].map(selector=>{const el=document.querySelector(selector),s=getComputedStyle(el),bg=selector.endsWith(' a')?getComputedStyle(document.querySelector('.profile-intro')).backgroundColor:s.backgroundColor;return ratio(rgb(s.color),rgb(bg))});
      })()`);
      assert(ratios.every(r=>r>=4.5),`${theme} ${accent}: ${ratios}`);
    }
  }
  console.log('PASS 14 theme/accent combinations: primary, secondary and profile link text >=4.5:1.');
  for(const route of ['profile','projects','feed','contact','github','settings']){
    await go(route);
    const unnamed=await evaluate(`(()=>{const elements=[...document.querySelectorAll('button,a,input,textarea,select,summary')];return elements.filter(e=>!e.disabled&&e.getBoundingClientRect().width&&e.getBoundingClientRect().height&&getComputedStyle(e).visibility!=='hidden'&&e.type!=='hidden').filter(e=>!(e.getAttribute('aria-label')?.trim()||e.getAttribute('aria-labelledby')?.split(' ').some(id=>document.getElementById(id)?.textContent.trim())||e.labels?.length||(!e.matches('input,textarea,select')&&e.textContent.trim()))).map(e=>e.outerHTML.slice(0,140))})()`);
    assert.deepEqual(unnamed,[],route+' controls need accessible names');
  }
  console.log('PASS Visible controls have names on six screens.');
  await go('profile');await evaluate("document.querySelector('.profile-hint summary').focus()");
  await call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});await pause(100);
  await check('Keyboard opens owner guidance',"document.querySelector('.profile-hint').open");
  await check('Summary has a visible focus ring',"parseFloat(getComputedStyle(document.querySelector('.profile-hint summary')).outlineWidth)>=3");
  await evaluate("document.querySelector('[data-action=edit-profile]').focus();document.querySelector('[data-action=edit-profile]').click()");
  for(let i=0;i<18;i++){
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    assert(await evaluate("document.querySelector('#dialog').contains(document.activeElement)"),'Focus escaped editor');
  }
  console.log('PASS Keyboard focus stays inside the native editor.');
  assert.deepEqual(errors,[]);
}finally{await evaluate("localStorage.removeItem('eric-profile-mock');localStorage.removeItem('eric-owner');location.hash='profile';location.reload()");ws.close()}


