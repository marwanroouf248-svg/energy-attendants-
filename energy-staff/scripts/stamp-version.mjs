// Stamps per-file content-hash tokens into the html entry points: every local js/css ref
// gets ?v=<sha1 of that file's bytes>. Run after ANY change to dist/ assets:
//   node scripts/stamp-version.mjs  (or npm run stamp)
// then upload the changed html + edited assets and restart.
// tests/asset-version.test.mjs FAILS if the stamp is stale. The server only serves
// immutable when ?v equals the live file hash, so an unstamped edit degrades to no-cache
// instead of poisoning the year-long cache.
import {readFileSync,writeFileSync} from 'node:fs';
import {contentToken} from '../server/asset-version.mjs';
for(const htmlPath of ['dist/index.html','dist/kiosk.html']){
 let html=readFileSync(htmlPath,'utf8');let n=0;
 html=html.replace(/((?:src|href)=")([^"?]+\.(?:js|css))(?:\?v=[^"]*)?"/g,(m,pre,u)=>{
  if(u.includes('://')||u.startsWith('data:'))return m;
  n++;return pre+u+'?v='+contentToken(readFileSync('dist/'+u))+'"';
 });
 writeFileSync(htmlPath,html);console.log(htmlPath,n,'assets stamped');
}
