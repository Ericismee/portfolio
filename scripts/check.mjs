import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const file of ['server.mjs',...(await readdir('src')).filter(f=>f.endsWith('.js')).map(f=>'src/'+f)]){
  const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
console.log('All application modules passed syntax checks.');
