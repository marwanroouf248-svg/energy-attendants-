import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace, employeeAction} from '../server/domain.mjs';

function ws(){const db=emptyWorkspace();db.staff=[{id:7,name:'أحمد كابتن',department:'التدريب',branch:'فرع فودافون'},{id:1,name:'الإدارة',branch:'فرع فودافون'}];return db}
const admin={id:1,role:'admin',full_name:'الإدارة',branch:'فرع فودافون',position:'مدير'};

test('task_assign without repeatTo creates one assignment',()=>{
  const db=ws();
  employeeAction(db,admin,'task_assign',{employeeId:7,day:'2026-10-20',title:'ترتيب الفلور'},'2026-10-20T08:00:00Z');
  assert.equal(db.dailyAssignments.length,1);
  assert.equal(db.dailyAssignments[0].day,'2026-10-20');
});
test('task_assign with repeatTo creates one per day inclusive',()=>{
  const db=ws();
  employeeAction(db,admin,'task_assign',{employeeId:7,day:'2026-10-20',repeatTo:'2026-10-24',title:'ترتيب الفلور'},'2026-10-20T08:00:00Z');
  assert.equal(db.dailyAssignments.length,5);
  assert.deepEqual(db.dailyAssignments.map(t=>t.day),['2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-24']);
});
test('repeat skips days already having the same title',()=>{
  const db=ws();
  employeeAction(db,admin,'task_assign',{employeeId:7,day:'2026-10-21',title:'ترتيب الفلور'},'2026-10-20T08:00:00Z');
  employeeAction(db,admin,'task_assign',{employeeId:7,day:'2026-10-20',repeatTo:'2026-10-23',title:'ترتيب الفلور'},'2026-10-20T08:00:00Z');
  assert.equal(db.dailyAssignments.length,4);
  assert.equal(db.dailyAssignments.filter(t=>t.day==='2026-10-21').length,1);
});
test('repeatTo before day or over 31 days rejected',()=>{
  const db=ws();
  assert.throws(()=>employeeAction(db,admin,'task_assign',{employeeId:7,day:'2026-10-20',repeatTo:'2026-10-19',title:'x'},'2026-10-20T08:00:00Z'),/INVALID_REPEAT/);
  assert.throws(()=>employeeAction(db,admin,'task_assign',{employeeId:7,day:'2026-10-20',repeatTo:'2026-11-25',title:'x'},'2026-10-20T08:00:00Z'),/INVALID_REPEAT/);
  assert.throws(()=>employeeAction(db,admin,'task_assign',{employeeId:7,day:'2026-10-20',repeatTo:'not-a-date',title:'x'},'2026-10-20T08:00:00Z'),/INVALID_REPEAT/);
});
test('31 days exactly allowed',()=>{
  const db=ws();
  employeeAction(db,admin,'task_assign',{employeeId:7,day:'2026-10-20',repeatTo:'2026-11-19',title:'يومي'},'2026-10-20T08:00:00Z');
  assert.equal(db.dailyAssignments.length,31);
});
test('month boundary handled via UTC iteration',()=>{
  const db=ws();
  employeeAction(db,admin,'task_assign',{employeeId:7,day:'2026-10-30',repeatTo:'2026-11-02',title:'يومي'},'2026-10-20T08:00:00Z');
  assert.deepEqual(db.dailyAssignments.map(t=>t.day),['2026-10-30','2026-10-31','2026-11-01','2026-11-02']);
});
