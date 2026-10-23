import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorkspace,employeeAction,visibleWorkspace,mayManage,positions,defaultAccessMatrix} from '../server/domain.mjs';
const A='فرع فودافون',B='فرع الرخاوي — سيدات';
function seed(){
 const db=emptyWorkspace();
 db.branches=[{name:A,lat:30,lng:31},{name:B,lat:32,lng:33}];
 db.staff=[
  {id:1,name:'Admin',position:'كابتن',department:positions['كابتن'],branch:A},
  {id:13,name:'Mariam',position:'كابتن',department:positions['كابتن'],branch:B},
  {id:20,name:'Cap B2',position:'كابتن',department:positions['كابتن'],branch:B},
  {id:21,name:'Cap A2',position:'كابتن',department:positions['كابتن'],branch:A},
  {id:30,name:'HK B',position:'عامل نظافة',department:positions['عامل نظافة']||'الهاوس كيبنج',branch:B}];
 db.punches=[{id:'p20',employeeId:20,branch:B,in:'2026-10-23T08:00:00Z',out:null},{id:'p21',employeeId:21,branch:A,in:'2026-10-23T08:00:00Z',out:null}];
 db.shifts=[{id:'sh1',name:'صباحي',branch:B,time:'09:00-17:00'},{id:'sh2',name:'صباحي',branch:A,time:'09:00-17:00'}];
 db.userAccess={active:true,grants:{'13':{attendance:{level:'edit',branches:'own',departments:'own'},tasks:{level:'edit',branches:'own',departments:'own'},staff:{level:'view',branches:'own',departments:'own'}}}};
 return {db,
  mariam:{id:13,role:'employee',position:'كابتن',branch:B,full_name:'Mariam'},
  capB2:{id:20,role:'employee',position:'كابتن',branch:B,full_name:'Cap B2'}};
}
test('employee with per-person grants sees granted scope and nothing beyond it',()=>{
 const {db,mariam}=seed();
 const w=visibleWorkspace(db,mariam);
 assert.deepEqual(w.staff.map(s=>s.id).sort((a,b)=>a-b),[13,20],'self + same-branch same-dept captains only');
 assert.deepEqual(w.punches.map(p=>p.id),['p20'],'granted attendance scope only');
 assert.deepEqual(w.shifts.map(s=>s.id),['sh1'],'employee baseline own-branch shifts preserved');
 assert.equal(w.myAccess.tasks.level,'edit');
 assert.equal(w.payrollRuns.length,0);
 assert.equal(w.myAccess.payroll,undefined,'no payroll grant');
});
test('grants drive mayManage within branch+dept only',()=>{
 const {db,mariam}=seed();
 const s20=db.staff.find(s=>s.id===20),s21=db.staff.find(s=>s.id===21),s30=db.staff.find(s=>s.id===30);
 assert.equal(mayManage(mariam,s20,'tasks','edit',db),true);
 assert.equal(mayManage(mariam,s20,'attendance','approve',db),true);
 assert.equal(mayManage(mariam,s21,'tasks','edit',db),false,'other branch denied');
 assert.equal(mayManage(mariam,s30,'tasks','edit',db),false,'other department denied');
 assert.equal(mayManage(mariam,s20,'payroll','view',db),false,'payroll denied');
 assert.equal(mayManage(mariam,s20,'requests','approve',db),false,'ungranted item denied');
});
test('task assign + review work inside scope, blocked outside',()=>{
 const {db,mariam}=seed();
 employeeAction(db,mariam,'task_assign',{employeeId:20,day:'2026-10-24',title:'ترتيب الفلور'},Date.parse('2026-10-23T13:00:00Z'));
 const t=db.dailyAssignments.find(t=>Number(t.employeeId)===20);
 assert.ok(t,'assignment created');
 t.status='submitted';
 employeeAction(db,mariam,'task_review',{id:t.id,approved:true},Date.parse('2026-10-23T14:00:00Z'));
 assert.equal(t.status,'approved');
 assert.throws(()=>employeeAction(db,mariam,'task_assign',{employeeId:21,day:'2026-10-24',title:'x'},Date.now()),/FORBIDDEN/);
});
test('per-person override narrows a manager below matrix scope',()=>{
 const {db}=seed();
 db.accessMatrix=defaultAccessMatrix();db.accessMatrix.active=true;
 const mgr={id:40,role:'manager',position:'مدير التدريب',branch:B,full_name:'Mgr'};
 db.staff.push({id:40,name:'Mgr',position:'مدير التدريب',department:positions['مدير التدريب'],branch:B});
 const s20=db.staff.find(s=>s.id===20);
 assert.equal(mayManage(mgr,s20,'tasks','edit',db),true,'matrix grants مدير التدريب tasks edit');
 db.userAccess.grants['40']={tasks:{level:'none',branches:'own',departments:'own'}};
 assert.equal(mayManage(mgr,s20,'tasks','edit',db),false,'override blocks tasks');
 assert.equal(mayManage(mgr,s20,'attendance','approve',db),true,'other items still follow matrix');
});
test('no grants: employee behavior unchanged',()=>{
 const {db,mariam,capB2}=seed();
 db.userAccess={active:true,grants:{}};
 const w=visibleWorkspace(db,mariam);
 assert.deepEqual(w.staff.map(s=>s.id),[13]);
 assert.equal(w.punches.length,0,'only own punches; none recorded for her');
 assert.equal(w.myAccess,null);
 const w2=visibleWorkspace(db,capB2);
 assert.deepEqual(w2.shifts.map(s=>s.id),['sh1']);
});
test('sanitizeUserAccess via emptyWorkspace/hydrate shape drops garbage',async()=>{
 const {sanitizeUserAccess}=await import('../server/domain.mjs');
 const ua=sanitizeUserAccess({grants:{'13':{tasks:{level:'edit',branches:'both',departments:'all'},evil:{level:'edit'},attendance:{level:'superuser'}},'x-y':{tasks:{level:'view'}}}});
 assert.deepEqual(ua.grants,{'13':{tasks:{level:'edit',branches:'both',departments:'all'}}});
});
test('messaging grant: none hides messages, view blocks send, edit allows; no grant unchanged',()=>{
 const {db,mariam}=seed();
 db.chatMessages=[{id:'m1',room:'all',body:'hi',at:'2026-10-23T10:00:00Z'},{id:'m2',room:'branch',branch:B,body:'branch hi',at:'2026-10-23T10:01:00Z'},{id:'m3',room:'branch',branch:A,body:'other branch',at:'2026-10-23T10:02:00Z'}];
 const base=visibleWorkspace(db,mariam);
 assert.deepEqual(base.chatMessages.map(m=>m.id),['m1','m2'],'default: all-room + own branch room');
 employeeAction(db,mariam,'chat_send',{body:'hello',room:'branch'},Date.parse('2026-10-23T13:00:00Z'));
 assert.ok(db.chatMessages.some(m=>m.body==='hello'),'default: send works');
 db.userAccess.grants['13']={messaging:{level:'view',branches:'own',departments:'own'}};
 const wv=visibleWorkspace(db,mariam);
 assert.deepEqual(wv.chatMessages.map(m=>m.id).filter(i=>i[0]==='m'),['m1','m2'],'view: still receives rooms');
 assert.throws(()=>employeeAction(db,mariam,'chat_send',{body:'x',room:'branch'},Date.now()),/FORBIDDEN/,'view: send denied');
 db.userAccess.grants['13']={messaging:{level:'none',branches:'own',departments:'own'}};
 assert.equal(visibleWorkspace(db,mariam).chatMessages.length,0,'none: no messages visible');
 assert.throws(()=>employeeAction(db,mariam,'chat_send',{body:'x',room:'all'},Date.now()),/FORBIDDEN/,'none: send denied');
 db.userAccess.grants['13']={messaging:{level:'edit',branches:'own',departments:'own'}};
 employeeAction(db,mariam,'chat_send',{body:'back',room:'branch'},Date.now());
 assert.ok(db.chatMessages.some(m=>m.body==='back'),'edit: send works');
});
test('extended items: faults/swaps/docs/kiosk/announcements enforce only with a grant, defaults unchanged',()=>{
 const {db,mariam}=seed();
 const s20=db.staff.find(s=>s.id===20);
 // defaults unchanged without grants
 employeeAction(db,mariam,'fault_create',{machine:'جهاز الجري 3',note:'صوت غريب'},Date.parse('2026-10-23T10:00:00Z'));
 assert.equal(db.faultReports.length,1,'default: employee creates fault');
 assert.throws(()=>employeeAction(db,mariam,'fault_resolve',{id:db.faultReports[0].id},Date.now()),/FORBIDDEN/,'default: employee cannot resolve');
 assert.throws(()=>employeeAction(db,mariam,'doc_add',{employeeId:20,type:'عقد',expiry:'2027-01-01'},Date.now()),/FORBIDDEN/,'default: employee cannot add docs');
 assert.throws(()=>employeeAction(db,mariam,'announcement_create',{kind:'branch',branch:B,title:'x',body:'y'},Date.now()),/FORBIDDEN/,'default: employee cannot announce');
 // faults: none blocks create+hides; approve grants resolve
 db.userAccess.grants['13']={faults:{level:'none',branches:'own',departments:'own'}};
 assert.throws(()=>employeeAction(db,mariam,'fault_create',{machine:'x',note:'y'},Date.now()),/FORBIDDEN/,'faults none: create denied');
 assert.equal(visibleWorkspace(db,mariam).faultReports.length,0,'faults none: hidden');
 db.userAccess.grants['13']={faults:{level:'approve',branches:'own',departments:'own'}};
 db.faultReports[0].status='open';
 employeeAction(db,mariam,'fault_resolve',{id:db.faultReports[0].id,note:'اتصلح'},Date.now());
 assert.equal(db.faultReports[0].status,'resolved','faults approve: resolve works in scope');
 // docs edit grant allows add in scope, denies out of scope
 db.userAccess.grants['13']={docs:{level:'edit',branches:'own',departments:'own'}};
 employeeAction(db,mariam,'doc_add',{employeeId:20,type:'عقد',expiry:'2027-01-01'},Date.now());
 assert.equal(db.documents.length,1,'docs edit: add works in scope');
 assert.throws(()=>employeeAction(db,mariam,'doc_add',{employeeId:21,type:'عقد',expiry:'2027-01-01'},Date.now()),/FORBIDDEN/,'docs edit: other branch denied');
 // kiosk edit grant allows pin set in scope
 db.userAccess.grants['13']={kiosk:{level:'edit',branches:'own',departments:'own'}};
 employeeAction(db,mariam,'kiosk_pin_set',{employeeId:20,pin:'4321'},Date.now());
 assert.ok(db.staff.find(s=>s.id===20).pinHash,'kiosk edit: pin set in scope');
 // announcements edit grant allows branch-scoped create for employee
 db.userAccess.grants['13']={announcements:{level:'edit',branches:'own',departments:'own'}};
 employeeAction(db,mariam,'announcement_create',{kind:'branch',branch:B,title:'تنبيه',body:'محتوى'},Date.now());
 assert.equal(db.announcements.length,1,'announcements edit: create works');
 db.userAccess.grants['13']={announcements:{level:'none',branches:'own',departments:'own'}};
 assert.equal(visibleWorkspace(db,mariam).announcements.length,0,'announcements none: hidden');
 assert.throws(()=>employeeAction(db,mariam,'announcement_ack',{id:db.announcements[0].id},Date.now()),/FORBIDDEN/,'announcements none: ack denied');
 // swaps: none blocks request
 db.userAccess.grants['13']={swaps:{level:'none',branches:'own',departments:'own'}};
 db.shiftAssignments.push({id:'sa13',employeeId:13,employeeName:'Mariam',branch:B,day:'2026-10-25',start:'09:00',end:'17:00'});
 assert.throws(()=>employeeAction(db,mariam,'shift_swap_request',{shiftId:'sa13',targetEmployeeId:20},Date.parse('2026-10-23T10:00:00Z')),/FORBIDDEN/,'swaps none: request denied');
});
