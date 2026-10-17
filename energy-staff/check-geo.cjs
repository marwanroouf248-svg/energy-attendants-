const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements={};function el(s){return elements[s]??={value:s==='#branch'?'كل الفروع':'',style:{},dataset:{},insertAdjacentHTML(){},addEventListener(){},showModal(){},close(){}}}
const ctx={document:{querySelector:el,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},structuredClone,console,URL,Blob,FormData,setTimeout(){},navigator:{}};vm.createContext(ctx);
for(const f of ['app.js','upgrades.js'])vm.runInContext(fs.readFileSync('dist/'+f,'utf8'),ctx);
const test=s=>vm.runInContext(s,ctx);
assert.equal(test('geoDecision({lat:null,lng:null},{latitude:30,longitude:31,accuracy:5}).ok'),false);
assert.equal(test('geoDecision({lat:30,lng:31},{latitude:30,longitude:31,accuracy:5}).ok'),true);
assert.equal(test('geoDecision({lat:30,lng:31},{latitude:30.001,longitude:31,accuracy:5}).ok'),false);
assert.equal(test('geoDecision({lat:30,lng:31},{latitude:30,longitude:31,accuracy:31}).ok'),false);
assert.equal(test('geoDecision({lat:30,lng:31},{latitude:30.00063,longitude:31,accuracy:15}).ok'),false);
assert.equal(test('geoDecision({lat:30,lng:31},{latitude:30,longitude:31,accuracy:NaN}).ok'),false);
for(const p of ['overview','attendance','staff','shifts','requests','payroll','tasks','permissions','locations','records','audit','archive']){test('page='+JSON.stringify(p)+';render()');assert(elements['#app'].innerHTML)}test("role='الموظف';render()");
console.log('PASS: 6 GPS boundary/accuracy cases, 12 admin views and employee view');
