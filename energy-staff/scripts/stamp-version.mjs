// Stamps content-hash version tokens into the html entry points. Run after ANY change to
// files in dist/ (js/css): node scripts/stamp-version.mjs — then upload the changed html
// plus the edited assets and restart. tests/asset-version.test.mjs fails if you forget.
import {readFileSync,writeFileSync} from 'node:fs';
import {stampToken} from '../server/asset-version.mjs';
for(const htmlPath of ['dist/index.html','dist/kiosk.html']){
 let html=readFileSync(htmlPath,'utf8');
 const refs=[...new Set([...html.matchAll(/(?:src|href)="([^"?]+?)(?:\?v=[^"]*)?"/g)].map(m=>m[1]).filter(u=>!u.includes('://')&&!u.startsWith('data:')&&/\.(js|css)$/.test(u)))].sort();
 const token=stampToken(refs.map(name=>({name,bytes:readFileSync('dist/'+name)})));
 html=html.replace(/((?:src|href)="[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"/g,'$1?v='+token+'"');
 writeFileSync(htmlPath,html);
 console.log(htmlPath,'v='+token,'('+refs.length+' assets)');
}
