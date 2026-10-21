import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace, employeeAction} from '../server/domain.mjs';

const A={name:'فرع فودافون',lat:30.0444,lng:31.2357};
function ws(){const db=emptyWorkspace();db.branches=[A];db.staff=[{id:1,name:'الإدارة',branch:'فرع فودافون'},{id:7,name:'أحمد كابتن',department:'التدريب',branch:'فرع فودافون',position:'كابتن'}];return db}
const admin={id:1,role:'admin',full_name:'الإدارة',branch:'فرع فودافون',position:'مدير'};
const mgrOther={id:2,role:'manager',full_name:'مدير فرع تاني',branch:'فرع الرخاوي',position:'كابتن'};
const emp={id:7,role:'employee',full_name:'أحمد كابتن',position:'كابتن',branch:'فرع فودافون'};

test('admin schedules insider + outsider classes with validation',()=>{
  const db=ws();
  employeeAction(db,admin,'class_create',{name:'Spinning',instructorType:'داخلي',captainStaffId:7,branch:'فرع فودافون',weekday:3,start:'18:00',end:'19:00',capacity:20});
  employeeAction(db,admin,'class_create',{name:'يوجا',instructorType:'خارجي',captainName:'كابتن سارة',branch:'فرع فودافون',weekday:3,start:'20:00',end:'21:00'});
  assert.equal(db.classes.length,2);
  assert.equal(db.classes[0].captainName,'أحمد كابتن');
  assert.equal(db.classes[1].captainStaffId,null);
  assert.throws(()=>employeeAction(db,admin,'class_create',{name:'x',branch:'فرع فودافون',weekday:3,start:'20:00',end:'20:00'}),/INVALID_DATE/);
  assert.throws(()=>employeeAction(db,admin,'class_create',{name:'x',branch:'فرع وهمي',weekday:3,start:'20:00',end:'21:00'}),/INVALID_INPUT/);
  assert.throws(()=>employeeAction(db,admin,'class_create',{name:'x',branch:'فرع فودافون',weekday:3,start:'20:00',end:'21:00'}),/INVALID_INPUT/);
});
test('manager of another branch cannot create or remove here',()=>{
  const db=ws();
  employeeAction(db,admin,'class_create',{name:'Spinning',instructorType:'داخلي',captainStaffId:7,branch:'فرع فودافون',weekday:3,start:'18:00',end:'19:00'});
  assert.throws(()=>employeeAction(db,mgrOther,'class_create',{name:'x',branch:'فرع فودافون',weekday:3,start:'20:00',end:'21:00',captainName:'y'}),/FORBIDDEN/);
  assert.throws(()=>employeeAction(db,mgrOther,'class_remove',{id:db.classes[0].id}),/FORBIDDEN/);
});
test('class_log records incidents without any financial effect',()=>{
  const db=ws();
  employeeAction(db,admin,'class_create',{name:'يوجا',instructorType:'خارجي',captainName:'كابتن سارة',branch:'فرع فودافون',weekday:3,start:'20:00',end:'21:00'});
  employeeAction(db,admin,'class_log',{classId:db.classes[0].id,day:'2026-10-21',status:'تمت',attendees:8,incidents:[{type:'تأخر الكابتن',minutes:15},{type:'غير معروف'}]});
  const l=db.classLogs[0];
  assert.equal(l.attendees,8);assert.equal(l.incidents.length,1);assert.equal(l.incidents[0].type,'تأخر الكابتن');
  assert.throws(()=>employeeAction(db,admin,'class_log',{classId:'nope',day:'2026-10-21'}),/NOT_FOUND/);
});
test('captain punching outside scheduled class window gets flagged + auto incident',()=>{
  const db=ws();
  employeeAction(db,admin,'class_create',{name:'Spinning',instructorType:'داخلي',captainStaffId:7,branch:'فرع فودافون',weekday:3,start:'18:00',end:'19:00'});
  // Wednesday 2026-10-21, 10:00 Cairo = 08:00 UTC (outside window)
  employeeAction(db,emp,'punch_in',{coords:{latitude:30.0444,longitude:31.2357,accuracy:10}},Date.parse('2026-10-21T08:00:00Z'));
  assert.equal(db.punches[0].classCheck,'حضور خارج جدول الحصص');
  assert.equal(db.classLogs.length,1);
  assert.equal(db.classLogs[0].incidents[0].type,'خارج الجدول');
  // second day punch within window: no incident (17:45 Cairo = 15:45 UTC next day)
  const db2=ws();
  employeeAction(db2,admin,'class_create',{name:'Spinning',instructorType:'داخلي',captainStaffId:7,branch:'فرع فودافون',weekday:3,start:'18:00',end:'19:00'});
  employeeAction(db2,emp,'punch_in',{coords:{latitude:30.0444,longitude:31.2357,accuracy:10}},Date.parse('2026-10-21T15:45:00Z'));
  assert.equal(db2.punches[0].classCheck,'داخل جدول الحصص');
  assert.equal(db2.classLogs.length,0);
});
test('captain self-registers own class: rate credited from schedule, window + duplicate + ownership enforced',()=>{
  const db=ws();
  employeeAction(db,admin,'class_create',{name:'Spinning',instructorType:'داخلي',captainStaffId:7,branch:'فرع فودافون',weekday:3,start:'18:00',end:'19:00',rate:999});
  assert.equal(db.classes[0].rate,30); // price fixed at 30 regardless of input
  const cid=db.classes[0].id;
  // Wednesday 2026-10-21, 18:10 Cairo = 16:10 UTC (inside window)
  employeeAction(db,emp,'class_register',{classId:cid},Date.parse('2026-10-21T16:10:00Z'));
  const l=db.classLogs[0];
  assert.equal(l.source,'self');assert.equal(l.credited,30);assert.equal(l.rate,30);assert.equal(l.captainStaffId,7);assert.equal(l.incidents.length,0);assert.equal(l.day,'2026-10-21');
  // duplicate same day blocked
  assert.throws(()=>employeeAction(db,emp,'class_register',{classId:cid},Date.parse('2026-10-21T16:30:00Z')),/ALREADY_EXISTS/);
  // outside window rejected (16:00 Cairo = 13:00 UTC during DST, before start-30min)
  const db2=ws();
  employeeAction(db2,admin,'class_create',{name:'Spinning',instructorType:'داخلي',captainStaffId:7,branch:'فرع فودافون',weekday:3,start:'18:00',end:'19:00'});
  assert.throws(()=>employeeAction(db2,emp,'class_register',{classId:db2.classes[0].id},Date.parse('2026-10-21T13:00:00Z')),/OUTSIDE_CLASS_WINDOW/);
  assert.equal(db2.classLogs.length,0);
  // inside grace edges allowed: 17:45 Cairo (=14:45 UTC, start-15min) and 19:50 Cairo (=16:50 UTC, end+50min)
  employeeAction(db2,emp,'class_register',{classId:db2.classes[0].id},Date.parse('2026-10-21T14:45:00Z'));
  assert.equal(db2.classLogs[0].credited,30);assert.equal(db2.classLogs[0].rate,30);
  // well after end rejected (21:00 Cairo = 18:00 UTC)
  const db2b=ws();
  employeeAction(db2b,admin,'class_create',{name:'Spinning',instructorType:'داخلي',captainStaffId:7,branch:'فرع فودافون',weekday:3,start:'18:00',end:'19:00'});
  assert.throws(()=>employeeAction(db2b,emp,'class_register',{classId:db2b.classes[0].id},Date.parse('2026-10-21T18:00:00Z')),/OUTSIDE_CLASS_WINDOW/);
  // wrong day rejected (Thursday 2026-10-22)
  const db3=ws();
  employeeAction(db3,admin,'class_create',{name:'Spinning',instructorType:'داخلي',captainStaffId:7,branch:'فرع فودافون',weekday:3,start:'18:00',end:'19:00',rate:30});
  assert.throws(()=>employeeAction(db3,emp,'class_register',{classId:db3.classes[0].id},Date.parse('2026-10-22T16:10:00Z')),/INVALID_DATE/);
  // another employee cannot register someone else's class
  const other={id:9,role:'employee',full_name:'موظف تاني',position:'ريسبشن',branch:'فرع فودافون'};
  assert.throws(()=>employeeAction(db3,other,'class_register',{classId:db3.classes[0].id},Date.parse('2026-10-21T16:10:00Z')),/FORBIDDEN/);
  // outside class (no staff link) cannot be self-registered
  employeeAction(db3,admin,'class_create',{name:'يوجا',instructorType:'خارجي',captainName:'كابتن سارة',branch:'فرع فودافون',weekday:3,start:'20:00',end:'21:00'});
  assert.throws(()=>employeeAction(db3,emp,'class_register',{classId:db3.classes[1].id},Date.parse('2026-10-21T16:10:00Z')),/FORBIDDEN/);
});
