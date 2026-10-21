import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,employeeAction,deleteStaffPermanent,visibleWorkspace,defaultAccessMatrix} from '../server/domain.mjs';

function seed(){
  const db=emptyWorkspace();
  db.branches.push({name:'فرع فودافون'},{name:'فرع الرخاوي'});
  db.staff.push(
    {id:1,name:'مروان رؤوف',position:'مدير عام',department:'الإدارة',branch:'فرع فودافون',cloudId:'1'},
    {id:2,name:'سارة سيلز',position:'سيلز',department:'السيلز',branch:'فرع فودافون',cloudId:'2'},
    {id:3,name:'كابتن أحمد',position:'كابتن',department:'التدريب',branch:'فرع فودافون',cloudId:'3'},
    {id:9,name:'قديم بدون حساب',position:'كابتن',department:'التدريب',branch:'فرع فودافون',legacyProfileId:'L9',needsActivation:true}
  );
  db.accessMatrix=defaultAccessMatrix();
  return db;
}
const admin={id:1,role:'admin',full_name:'مروان رؤوف',position:'مدير عام',branch:'فرع فودافون'};

test('request_create_for creates a pending request marked on behalf',()=>{
  const db=seed();
  employeeAction(db,admin,'request_create_for',{employeeId:3,type:'إجازة اعتيادية',detail:'ظرف عائلي',day:'2026-10-25',hours:2.2},'2026-10-21T08:00:00Z');
  const r=db.requests.at(-1);
  assert.equal(r.employeeId,3);assert.equal(r.name,'كابتن أحمد');assert.equal(r.status,'معلق');
  assert.equal(r.onBehalf,true);assert.equal(r.createdBy,'مروان رؤوف');assert.equal(r.hours,2);assert.equal(r.branch,'فرع فودافون');
});

test('request_create_for blocked for employees and out-of-scope managers',()=>{
  const db=seed();
  const emp={id:3,role:'employee',full_name:'كابتن أحمد',position:'كابتن',branch:'فرع فودافون'};
  assert.throws(()=>employeeAction(db,emp,'request_create_for',{employeeId:2,type:'x',detail:'y'}),/FORBIDDEN/);
  // manager without matrix grant (matrix active, no grant for position) cannot create for others
  const mgr={id:5,role:'manager',full_name:'مدير سيلز',position:'مدير السيلز',branch:'فرع فودافون'};
  db.staff.push({id:5,name:'مدير سيلز',position:'مدير السيلز',department:'السيلز',branch:'فرع فودافون',cloudId:'5'});
  db.accessMatrix.active=true;
  assert.throws(()=>employeeAction(db,mgr,'request_create_for',{employeeId:3,type:'x',detail:'y'}),/FORBIDDEN/);
  // sales manager CAN create for sales staff in own branch (ownOwn requests approve own dept? requests cell own/own/approve)
  employeeAction(db,mgr,'request_create_for',{employeeId:2,type:'إذن',detail:'ظرف'},'2026-10-21T08:00:00Z');
  assert.equal(db.requests.at(-1).employeeId,2);
});

test('staff_delete_permanent: admin only, exact name, no linked account, cascades',()=>{
  const db=seed();
  db.punches.push({id:'p1',employeeId:9,name:'قديم بدون حساب',branch:'فرع فودافون',in:'2026-10-20T08:00:00Z',out:'2026-10-20T16:00:00Z'});
  db.points.push({id:'pt1',employeeId:9,color:'red',amount:1,reason:'x',at:'2026-10-20T10:00:00Z'});
  // non-admin blocked
  assert.throws(()=>employeeAction(db,{id:2,role:'employee',full_name:'سارة سيلز',position:'سيلز',branch:'فرع فودافون'},'staff_delete_permanent',{employeeId:9,confirmName:'قديم بدون حساب'}),/FORBIDDEN/);
  // wrong confirm name
  assert.throws(()=>employeeAction(db,admin,'staff_delete_permanent',{employeeId:9,confirmName:'اسم غلط'}),/CONFIRM_NAME/);
  // linked account refused (use members endpoint)
  assert.throws(()=>employeeAction(db,admin,'staff_delete_permanent',{employeeId:3,confirmName:'كابتن أحمد'}),/ACCOUNT_LINKED/);
  // self refused
  assert.throws(()=>employeeAction(db,admin,'staff_delete_permanent',{employeeId:1,confirmName:'مروان رؤوف'}),/FORBIDDEN/);
  employeeAction(db,admin,'staff_delete_permanent',{employeeId:9,confirmName:'قديم بدون حساب'});
  assert.equal(db.staff.some(s=>s.id===9),false);
  assert.equal(db.punches.length,0);assert.equal(db.points.length,0);
});

test('deleteStaffPermanent removes swaps, claims and unlinks class captains',()=>{
  const db=seed();
  db.shiftSwapRequests.push({id:'sw1',shiftId:'x',requesterId:3,targetId:2,status:'pending'});
  db.openShifts.push({id:'o1',branch:'فرع فودافون',department:'التدريب',day:'2026-10-25',start:'10:00',end:'16:00',status:'open',claims:[{id:'c1',employeeId:3,status:'pending'}]});
  db.classes.push({id:'k1',name:'سبيننج',captainName:'كابتن أحمد',captainStaffId:3,branch:'فرع فودافون',active:true});
  const t=deleteStaffPermanent(db,3);
  assert.equal(t.name,'كابتن أحمد');
  assert.equal(db.shiftSwapRequests.length,0);
  assert.equal(db.openShifts[0].claims.length,0);
  assert.equal(db.classes[0].captainStaffId,null);
  assert.equal(db.classes[0].captainName,'كابتن أحمد');
  assert.equal(db.staff.some(s=>s.id===3),false);
});
