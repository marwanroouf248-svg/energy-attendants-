import test from 'node:test';import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/hostinger.js',import.meta.url),'utf8');
const items=source.match(/const STAFF_ACCESS_ITEMS=.*$/m)[0];
const uaSummary=source.match(/function staffAccessUaSummary[\s\S]*?\n}/)[0];
const scope=source.match(/function staffAccessScope[\s\S]*?\n}\n/)[0];
const view=source.match(/function staffAccessView[\s\S]*?\n}\n/)[0];
function ctx(serverMembers,db){
 const context=vm.createContext({
  serverMembers,db,
  esc:s=>String(s??''),
  card:(t,b)=>t+'|'+b,
 });
 vm.runInContext([items,uaSummary,scope,view].join('\n'),context);
 return context;
}
const db={staff:[{id:1,department:'التدريب',branchAccess:'both'},{id:2,department:'التدريب'},{id:3,department:'السيلز'}],accessMatrix:{active:true,grants:{'مدير التدريب':{tasks:{level:'edit'},attendance:{level:'approve'},reports:{level:'view'},payroll:{level:'none'}}}}};
const members=[
 {id:1,full_name:'Manager One',role:'manager',position:'مدير التدريب',branch:'فرع فودافون',status:'approved'},
 {id:2,full_name:'Boss',role:'admin',position:'مدير عام',branch:'فرع فودافون',status:'approved'},
 {id:3,full_name:'Emp One',role:'employee',position:'كابتن',branch:'فرع الرخاوي — سيدات',status:'pending'}];

test('scope summary per role: admin full, employee own data, manager matrix levels',()=>{
 const c=ctx(members,db);
 assert.ok(c.staffAccessScope(members[1]).includes('إدارة كاملة'));
 assert.ok(c.staffAccessScope(members[2]).includes('بياناته الشخصية'));
 const ms=c.staffAccessScope(members[0]);
 assert.ok(ms.includes('تعديل')&&ms.includes('المهام'));
 assert.ok(ms.includes('اعتماد')&&ms.includes('الحضور والانصراف'));
 assert.ok(ms.includes('عرض')&&ms.includes('التقارير'));
 assert.ok(!ms.includes('المرتبات</b>')); // payroll level none never listed
});

test('page lists every account with role, branch, attendance access and manage button',()=>{
 const c=ctx(members,db);
 const html=c.staffAccessView();
 assert.ok(html.includes('Manager One')&&html.includes('Emp One')&&html.includes('Boss'));
 assert.ok(html.includes('مدير قسم')&&html.includes('إدارة')&&html.includes('موظف'));
 assert.ok(html.includes('منتظر الموافقة'));
 assert.ok(html.includes('البصمة: الفرعين')); // from staff.branchAccess
 assert.ok(html.includes('data-sa-review="1"')&&html.includes('data-sa-review="3"'));
});

test('nav entry registered and source keeps admin guard on the page',()=>{
 assert.ok(source.includes("navs.push(['staff-access','⚿','أكسس كل موظف'])"));
 assert.ok(source.includes("if(!nodeUser||nodeUser.role!=='admin')"));
});

test('auto-refresh poller installed with typing guard and chat draft preservation',()=>{
 assert.ok(source.includes('setInterval(async()=>{'),'poller exists');
 assert.ok(source.includes("page==='chat'"),'chat draft handling');
 assert.ok(source.includes("document.querySelector('#modal[open]')"),'modal guard');
 assert.ok(source.includes("'#app input,#app textarea'"),'typing guard');
 assert.ok(source.includes('},30000)'),'30s cadence');
});
