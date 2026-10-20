import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorkspace,employeeAction,visibleWorkspace,hydrateWorkspace,defaultAssessors,slotAllowed,availabilityConfigured} from '../server/domain.mjs';
const VOD='فرع فودافون',RAKH='فرع الرخاوي — سيدات';
const admin={id:1,full_name:'Owner',role:'admin',position:'كابتن',branch:VOD};
const sales={id:2,full_name:'Sales One',role:'employee',position:'سيلز',branch:VOD};
const salesR={id:3,full_name:'Sales R',role:'employee',position:'سيلز',branch:RAKH};
const MON=Date.parse('2026-10-19T08:00:00Z'); // الإثنين 11 صباحًا بتوقيت القاهرة
function ws(){const db=emptyWorkspace();db.branches=[{name:VOD,lat:30,lng:31},{name:RAKH,lat:29,lng:32}];db.staff=[{id:1,name:'Owner',department:'التدريب',branch:VOD},{id:2,name:'Sales One',department:'السيلز',branch:VOD},{id:3,name:'Sales R',department:'السيلز',branch:RAKH}];db.assessors=defaultAssessors();db.assessorsSeeded=true;return db}
test('assessor seeding gives the four named doctors on the reconciled branches, once',()=>{
 const db=hydrateWorkspace({branches:[{name:'الفرع الرئيسي',lat:null,lng:null},{name:'فرع الرخاوي',lat:null,lng:null}]},[{id:9,full_name:'Doc Yassin',position:'أسسمنت — دكتور علاج طبيعي',branch:'فرع فودافون',role:'employee',status:'approved'}]);
 assert.equal(db.assessors.length,4);
 assert.deepEqual(db.assessors.map(a=>a.name).sort(),['دكتور محمد ياسين','دكتور محمد هشام','دكتورة ليلى','دكتورة هنا'].sort());
 assert.equal(db.assessors.filter(a=>a.branch===VOD).length,2);
 assert.equal(db.assessors.filter(a=>a.branch===RAKH).length,2);
});
test('assessor links to a same-name staff doctor account',()=>{
 const db=hydrateWorkspace({branches:[{name:VOD,lat:30,lng:31}]},[{id:9,full_name:'دكتور محمد ياسين',position:'أسسمنت — دكتور علاج طبيعي',branch:VOD,role:'employee',status:'approved'}]);
 const yassin=db.assessors.find(a=>a.id==='asr-yassin');
 assert.equal(yassin.staffId,9);
});
test('booking with assessor id, double-booking blocked, cancel and postpone free the slot',()=>{
 const db=ws(),base={branch:VOD,assessorId:'asr-yassin',patientName:'عميل أول',phone:'01000000001'};
 employeeAction(db,sales,'assessment_create',{...base,day:'2026-10-19',time:'17:00'},MON);
 assert.equal(db.assessmentBookings[0].doctorName,'دكتور محمد ياسين');
 assert.throws(()=>employeeAction(db,sales,'assessment_create',{...base,day:'2026-10-19',time:'17:00'},MON),/SLOT_BOOKED/);
 assert.doesNotThrow(()=>employeeAction(db,sales,'assessment_create',{...base,day:'2026-10-19',time:'17:30'},MON));
 const otherDoctor={...base,assessorId:'asr-hesham',day:'2026-10-19',time:'17:00'};
 assert.doesNotThrow(()=>employeeAction(db,sales,'assessment_create',otherDoctor,MON)); // same time, different doctor
 // cancel frees the slot
 const id=db.assessmentBookings[0].id;
 employeeAction(db,sales,'assessment_update',{id,status:'cancelled'},MON);
 assert.doesNotThrow(()=>employeeAction(db,sales,'assessment_create',{...base,day:'2026-10-19',time:'17:00'},MON));
 // postpone frees the old slot and occupies the new one
 const id2=db.assessmentBookings.at(-1).id;
 employeeAction(db,sales,'assessment_postpone',{id:id2,day:'2026-10-20',time:'18:00'},MON);
 const oldB=db.assessmentBookings.find(a=>a.id===id2),newB=db.assessmentBookings.at(-1);
 assert.equal(oldB.bookingStatus,'postponed');assert.deepEqual(oldB.postponedTo,{day:'2026-10-20',time:'18:00'});
 assert.equal(newB.bookingStatus,'booked');assert.equal(newB.rescheduledFrom,String(id2));assert.equal(newB.confirmCall,null);
 assert.doesNotThrow(()=>employeeAction(db,sales,'assessment_create',{...base,day:'2026-10-19',time:'17:00'},MON)); // old slot free again
 assert.throws(()=>employeeAction(db,sales,'assessment_create',{...base,day:'2026-10-20',time:'18:00'},MON),/SLOT_BOOKED/); // new slot taken
 assert.throws(()=>employeeAction(db,sales,'assessment_postpone',{id:id2,day:'2026-10-21',time:'18:00'},MON),/INVALID_STATE/); // already postponed
});
test('weekly availability restricts bookable slots when configured',()=>{
 const db=ws();
 employeeAction(db,admin,'assessor_save',{id:'asr-yassin',name:'دكتور محمد ياسين',branch:VOD,active:true,availability:{'1':['17:00','17:30']}},MON);
 const base={branch:VOD,assessorId:'asr-yassin',patientName:'عميل',phone:'01000000001'};
 assert.doesNotThrow(()=>employeeAction(db,sales,'assessment_create',{...base,day:'2026-10-19',time:'17:00'},MON)); // Monday slot allowed
 assert.throws(()=>employeeAction(db,sales,'assessment_create',{...base,day:'2026-10-19',time:'18:00'},MON),/SLOT_UNAVAILABLE/); // not in list
 assert.throws(()=>employeeAction(db,sales,'assessment_create',{...base,day:'2026-10-20',time:'17:00'},MON),/SLOT_UNAVAILABLE/); // Tuesday: no work
});
test('confirmation call is recorded and requires a booked appointment in the same branch',()=>{
 const db=ws();
 employeeAction(db,sales,'assessment_create',{branch:VOD,assessorId:'asr-yassin',patientName:'عميلة',phone:'01000000009',day:'2026-10-19',time:'17:00'},MON);
 const id=db.assessmentBookings[0].id;
 assert.throws(()=>employeeAction(db,salesR,'assessment_confirm',{id,done:true},MON),/FORBIDDEN/);
 employeeAction(db,sales,'assessment_confirm',{id,done:true},MON);
 assert.equal(db.assessmentBookings[0].confirmCall.done,true);
 assert.equal(db.assessmentBookings[0].confirmCall.byName,'Sales One');
 employeeAction(db,sales,'assessment_update',{id,status:'attended'},MON);
 assert.throws(()=>employeeAction(db,sales,'assessment_confirm',{id,done:true},MON),/INVALID_STATE/);
});
test('sales can now mark attended and no_show; other statuses stay medical/admin',()=>{
 const db=ws();
 employeeAction(db,sales,'assessment_create',{branch:VOD,assessorId:'asr-hesham',patientName:'عميل',phone:'01000000002',day:'2026-10-19',time:'17:00'},MON);
 const id=db.assessmentBookings[0].id;
 employeeAction(db,sales,'assessment_update',{id,status:'attended'},MON);
 assert.equal(db.assessmentBookings[0].bookingStatus,'attended');
 assert.throws(()=>employeeAction(db,sales,'assessment_update',{id,status:'completed'},MON),/FORBIDDEN/);
});
test('assessor management is admin-only and removal is blocked by active bookings',()=>{
 const db=ws();
 assert.throws(()=>employeeAction(db,sales,'assessor_save',{name:'دكتور جديد',branch:VOD,active:true,availability:{}},MON),/FORBIDDEN/);
 employeeAction(db,admin,'assessor_save',{name:'دكتور جديد',branch:VOD,active:true,availability:{'2':['10:00','10:30','bad','25:99']}},MON);
 const added=db.assessors.at(-1);
 assert.deepEqual(added.availability,{'2':['10:00','10:30']});
 employeeAction(db,sales,'assessment_create',{branch:VOD,assessorId:added.id,patientName:'عميل',phone:'01000000003',day:'2026-10-20',time:'10:00'},MON);
 assert.throws(()=>employeeAction(db,admin,'assessor_remove',{id:added.id},MON),/HAS_ACTIVE_BOOKINGS/);
 employeeAction(db,sales,'assessment_update',{id:db.assessmentBookings.at(-1).id,status:'cancelled'},MON);
 assert.doesNotThrow(()=>employeeAction(db,admin,'assessor_remove',{id:added.id},MON));
});
test('non-admin workspace exposes branch assessors without inactive ones',()=>{
 const db=ws();
 db.assessors.find(a=>a.id==='asr-laila').active=false;
 const out=visibleWorkspace(db,sales);
 assert.deepEqual(out.assessors.map(a=>a.id).sort(),['asr-hesham','asr-yassin']);
 const outR=visibleWorkspace(db,salesR);
 assert.deepEqual(outR.assessors.map(a=>a.id),['asr-hana']);
});
