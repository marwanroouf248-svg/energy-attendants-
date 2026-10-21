import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace, employeeAction} from '../server/domain.mjs';

function ws(){const db=emptyWorkspace();db.staff=[{id:1,name:'الإدارة',branch:'فرع فودافون'},{id:2,name:'مدير التدريب',department:'التدريب',branch:'فرع فودافون',position:'كابتن'},{id:7,name:'أحمد كابتن',department:'التدريب',branch:'فرع فودافون',position:'كابتن'},{id:8,name:'منى سيلز',department:'السيلز',branch:'فرع فودافون',position:'سيلز'},{id:9,name:'كابتن فرع تاني',department:'التدريب',branch:'فرع الرخاوي',position:'كابتن'}];return db}
const admin={id:1,role:'admin',full_name:'الإدارة',branch:'فرع فودافون',position:'مدير'};
const trainingMgr={id:2,role:'manager',full_name:'مدير التدريب',branch:'فرع فودافون',position:'كابتن'};

test('request_create stores day and half-hour-rounded hours',()=>{
  const db=ws();
  employeeAction(db,{id:7,role:'employee',full_name:'أحمد كابتن',position:'كابتن',branch:'فرع فودافون'},'request_create',{type:'إذن تأخير وصول',detail:'ظرف طارئ',day:'2026-10-22',hours:1.3},'2026-10-21T08:00:00Z');
  const r=db.requests[0];
  assert.equal(r.status,'معلق');assert.equal(r.day,'2026-10-22');assert.equal(r.hours,1.5);
});
test('request_create rejects invalid day or hours',()=>{
  const db=ws();const emp={id:7,role:'employee',full_name:'أحمد كابتن',position:'كابتن',branch:'فرع فودافون'};
  assert.throws(()=>employeeAction(db,emp,'request_create',{type:'إذن',detail:'x',day:'22/10/2026'}),/INVALID_DATE/);
  assert.throws(()=>employeeAction(db,emp,'request_create',{type:'إذن',detail:'x',hours:30}),/INVALID_INPUT/);
});
test('manager reviews request of own dept+branch with paid flag',()=>{
  const db=ws();
  employeeAction(db,{id:7,role:'employee',full_name:'أحمد كابتن',position:'كابتن',branch:'فرع فودافون'},'request_create',{type:'إذن انصراف مبكر',detail:'موعد',hours:2},'2026-10-21T08:00:00Z');
  const id=db.requests[0].id;
  employeeAction(db,trainingMgr,'request_review',{id,approved:true,paid:true,hours:2},'2026-10-21T09:00:00Z');
  const r=db.requests[0];
  assert.equal(r.status,'مقبول');assert.equal(r.paid,true);assert.equal(r.hours,2);assert.equal(r.reviewedBy,'مدير التدريب');assert.ok(r.reviewedAt);
});
test('manager cannot review other dept or other branch requests',()=>{
  const db=ws();
  employeeAction(db,{id:8,role:'employee',full_name:'منى سيلز',position:'سيلز',branch:'فرع فودافون'},'request_create',{type:'إجازة اعتيادية',detail:'يوم'},'2026-10-21T08:00:00Z');
  employeeAction(db,{id:9,role:'employee',full_name:'كابتن فرع تاني',position:'كابتن',branch:'فرع الرخاوي'},'request_create',{type:'إجازة مرضية',detail:'يوم'},'2026-10-21T08:00:00Z');
  const [salesReq,otherBranchReq]=db.requests;
  assert.throws(()=>employeeAction(db,trainingMgr,'request_review',{id:salesReq.id,approved:true}),/FORBIDDEN/);
  assert.throws(()=>employeeAction(db,trainingMgr,'request_review',{id:otherBranchReq.id,approved:true}),/FORBIDDEN/);
});
test('rejection keeps note and blocks double review',()=>{
  const db=ws();
  employeeAction(db,{id:7,role:'employee',full_name:'أحمد كابتن',position:'كابتن',branch:'فرع فودافون'},'request_create',{type:'تبديل وردية',detail:'مع فلان'},'2026-10-21T08:00:00Z');
  const id=db.requests[0].id;
  employeeAction(db,admin,'request_review',{id,approved:false,note:'اليوم ده مش مناسب'},'2026-10-21T09:00:00Z');
  assert.equal(db.requests[0].status,'مرفوض');assert.equal(db.requests[0].reviewNote,'اليوم ده مش مناسب');
  assert.throws(()=>employeeAction(db,admin,'request_review',{id,approved:true}),/INVALID_STATE/);
});
