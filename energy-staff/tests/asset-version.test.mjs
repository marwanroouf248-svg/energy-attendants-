import test from 'node:test';import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.PUBLIC_ORIGIN='http://localhost:3000';process.env.INITIAL_ADMIN_EMAIL='owner@example.test';process.env.ADMIN_SETUP_TOKEN='test-setup-token-'.repeat(3);
import {readFileSync} from 'node:fs';
import {contentToken} from '../server/asset-version.mjs';
const {server}=await import('../server/index.mjs');
for(const htmlPath of ['dist/index.html','dist/kiosk.html']){
 test(htmlPath+' every local js/css ref carries that file live content token',()=>{
  const html=readFileSync(htmlPath,'utf8');
  const refs=[...new Set([...html.matchAll(/(?:src|href)="([^"?]+?)(?:\?v=[^"]*)?"/g)].map(m=>m[1]).filter(u=>!u.includes('://')&&!u.startsWith('data:')&&/\.(js|css)$/.test(u)))];
  assert(refs.length>5,'expected stamped asset refs');
  const stale=refs.filter(r=>!html.includes('"'+r+'?v='+contentToken(readFileSync('dist/'+r))+'"'));
  assert.deepEqual(stale,[],'run: node scripts/stamp-version.mjs (stale refs in '+htmlPath+')');
 });
}
test('server marks immutable only when ?v equals the live content token',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const token=contentToken(readFileSync('dist/hostinger.js'));
  const good=await fetch(base+'/hostinger.js?v='+token);
  assert.equal(good.headers.get('cache-control'),'public, max-age=31536000, immutable');
  const wrong=await fetch(base+'/hostinger.js?v=stale-token');
  assert.equal(wrong.headers.get('cache-control'),'no-cache');
  const plain=await fetch(base+'/hostinger.js');
  assert.equal(plain.headers.get('cache-control'),'no-cache');
  const api=await fetch(base+'/api/health');
  assert.equal(api.headers.get('cache-control'),'no-store');
 }finally{server.close()}
});
