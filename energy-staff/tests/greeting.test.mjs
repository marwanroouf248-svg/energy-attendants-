import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const greeting=source.match(/function overviewGreeting\(\).*$/m)[0];
for(const role of ['admin','manager','employee']){
 test('overview greeting uses authenticated name for '+role,()=>{
  for(const name of ['مروان','سارة','Karim']){
   const context=vm.createContext({nodeUser:{role,full_name:name}});
   vm.runInContext(greeting,context);
   assert.equal(context.overviewGreeting(),'أهلًا، '+name+' ✳');
  }
 });
}
test('overview never falls back to a demo name',()=>{
 for(const data of [{},{nodeUser:null},{nodeUser:{}},{nodeUser:{full_name:''}}]){
  const context=vm.createContext(data);vm.runInContext(greeting,context);
  assert.equal(context.overviewGreeting(),'أهلًا بيك، جاهز ليوم جديد؟ ✳');
 }
 assert.ok(!source.includes('أهلًا أحمد، جاهز ليوم جديد؟'));
});
