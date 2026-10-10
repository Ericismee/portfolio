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
const mode=process.argv[2];assert(['record','compare'].includes(mode),'Use record or compare');
const samples={};
try{
  await call('Runtime.enable');await call('Page.enable');
  await evaluate("localStorage.removeItem('eric-profile-mock');localStorage.removeItem('eric-owner');location.hash='profile';location.reload()");await pause(400);
  for(const theme of ['light','dark']){
    await go('settings');await evaluate("document.querySelector('#theme-select').value="+JSON.stringify(theme)+";document.querySelector('#theme-select').dispatchEvent(new Event('change',{bubbles:true}))");
    for(const width of [390,1440]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      for(const route of ['profile','projects','feed','contact','github','settings']){
        await go(route);await evaluate('document.fonts.ready.then(()=>true)');
        samples[theme+'/'+width+'/'+route]=await evaluate("[...document.querySelectorAll('#app *:not(svg):not(path):not(circle):not(rect)')].map(e=>{const s=getComputedStyle(e);return ['display','position','width','height','padding','margin','gap','color','backgroundColor','border','borderRadius','boxShadow','font','lineHeight','outline','overflow','transform','gridTemplateColumns','flexDirection','minHeight'].map(p=>s[p])})");
      }
    }
  }
  if(mode==='record'){await fs.writeFile('.qa-css-before.json',JSON.stringify(samples));console.log('Recorded 24 computed-style snapshots.')}
  else{assert.deepEqual(samples,JSON.parse(await fs.readFile('.qa-css-before.json','utf8')));console.log('PASS 24 computed-style snapshots unchanged after CSS cleanup.')}
}finally{await evaluate("localStorage.removeItem('eric-profile-mock');localStorage.removeItem('eric-owner');location.hash='profile';location.reload()");ws.close()}
