import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorkspace,employeeAction,visibleWorkspace,positions,hydrateWorkspace,findStaffByPin,kioskPunch} from '../server/domain.mjs';

function seed(){
 const db=emptyWorkspace();
 db.branches=[{name:'A',lat:30,lng:31},{name:'B',lat:32,lng:33}];
 db.staff=[
  {id:1,name:'Emp One',position:'كابتن',department:positions['كابتن'],branch:'A'},
  {id:2,name:'Mgr One',position:'كابتن',department:positions['كابتن'],branch:'A'},
  {id:3,name:'Emp Two',position:'كابتن',department:positions['كابتن'],branch:'A'},
  {id:4,name:'Sales B',position:'سيلز',department:positions['سيلز'],branch:'B'},
  {id:5,name:'Admin',branch:'A'}];
 return {db,
  emp:{id:1,role:'employee',position:'كابتن',branch:'A',full_name:'Emp One'},
  emp2:{id:3,role:'employee',position:'كابتن',branch:'A',full_name:'Emp Two'},
  mgr:{id:2,role:'manager',position:'كابتن',branch:'A',full_name:'Mgr One'},
  otherBranch:{id:4,role:'manager',position:'سيلز',branch:'B',full_name:'Sales B'},
  admin:{id:5,role:'admin',full_name:'Admin'}};
}
const t=Date.parse('2026-10-19T06:00Z');
const coords={latitude:30,longitude:31,accuracy:5};

test('fault reports: create, scope visibility, resolve by manager of same department and branch only',()=>{
 const {db,emp,emp2,mgr,otherBranch,admin}=seed();
 employeeAction(db,emp,'fault_create',{machine:'جهاز الجري 3',note:'الحزام بيهتز',urgency:'عاجل'},t);
 assert.equal(db.faultReports.length,1);
 assert.equal(db.faultReports[0].status,'open');
 assert.equal(db.faultReports[0].urgency,'عاجل');
 assert.equal(visibleWorkspace(db,emp).faultReports.length,1);
 assert.equal(visibleWorkspace(db,emp2).faultReports.length,0);
 assert.equal(visibleWorkspace(db,mgr).faultReports.length,1);
 assert.equal(visibleWorkspace(db,otherBranch).faultReports.length,0);
 assert.equal(visibleWorkspace(db,admin).faultReports.length,1);
 assert.throws(()=>employeeAction(db,otherBranch,'fault_resolve',{id:db.faultReports[0].id,note:'x'},t),/FORBIDDEN/);
 assert.throws(()=>employeeAction(db,emp,'fault_resolve',{id:db.faultReports[0].id,note:'x'},t),/FORBIDDEN/);
 employeeAction(db,mgr,'fault_resolve',{id:db.faultReports[0].id,note:'اتصلت بالصيانة واتصلحت'},t+1000);
 assert.equal(db.faultReports[0].status,'resolved');
 assert.equal(db.faultReports[0].resolvedBy,'Mgr One');
 assert.throws(()=>employeeAction(db,mgr,'fault_resolve',{id:db.faultReports[0].id,note:'again'},t),/INVALID_STATE/);
 assert.throws(()=>employeeAction(db,emp,'fault_create',{machine:'',note:'x'},t),/INVALID_INPUT/);
});

test('handover note saved on punch_out and surfaced to the next shift in the same branch',()=>{
 const {db,emp,emp2}=seed();
 employeeAction(db,emp,'punch_in',{coords},t);
 employeeAction(db,emp,'punch_out',{coords,handoverNote:' جهاز الكابل محتاج فرد  '},t+8*36e5);
 assert.equal(db.punches[0].handover.note,'جهاز الكابل محتاج فرد');
 assert.equal(db.punches[0].handover.by,'Emp One');
 employeeAction(db,emp2,'punch_in',{coords},t+26*36e5);
 const view=visibleWorkspace(db,emp2);
 assert.equal(view.lastHandover.note,'جهاز الكابل محتاج فرد');
 assert.equal(view.lastHandover.by,'Emp One');
 const {db:db2,emp:e2}=seed();
 employeeAction(db2,e2,'punch_in',{coords},t);employeeAction(db2,e2,'punch_out',{coords,handoverNote:'   '},t+8*36e5);
 assert.equal(db2.punches[0].handover,undefined);
 const {db:db3,emp:e3}=seed();
 employeeAction(db3,e3,'punch_in',{coords},t);
 assert.throws(()=>employeeAction(db3,e3,'punch_out',{coords,handoverNote:'x'.repeat(1001)},t+8*36e5),/INVALID_INPUT/);
});

test('shift swap: validation, manager approval swaps atomically, rejection leaves shift untouched',()=>{
 const {db,emp,emp2,mgr,otherBranch,admin}=seed();
 employeeAction(db,mgr,'shift_assign',{employeeId:1,day:'2026-10-21',start:'09:00',end:'17:00'},t);
 const shift=db.shiftAssignments[0];
 // cannot request against a colleague with a shift that day
 employeeAction(db,mgr,'shift_assign',{employeeId:3,day:'2026-10-21',start:'14:00',end:'22:00'},t);
 assert.throws(()=>employeeAction(db,emp,'shift_swap_request',{shiftId:shift.id,targetEmployeeId:3},t),/SHIFT_EXISTS/);
 employeeAction(db,mgr,'shift_remove',{id:db.shiftAssignments[1].id},t);
 // cross-department/branch target rejected
 assert.throws(()=>employeeAction(db,emp,'shift_swap_request',{shiftId:shift.id,targetEmployeeId:4},t),/INVALID_INPUT/);
 // self and non-owner rejected
 assert.throws(()=>employeeAction(db,emp,'shift_swap_request',{shiftId:shift.id,targetEmployeeId:1},t),/INVALID_INPUT/);
 assert.throws(()=>employeeAction(db,emp2,'shift_swap_request',{shiftId:shift.id,targetEmployeeId:3},t),/FORBIDDEN/);
 // past shift rejected
 employeeAction(db,mgr,'shift_assign',{employeeId:1,day:'2026-10-18',start:'09:00',end:'17:00'},t);
 assert.throws(()=>employeeAction(db,emp,'shift_swap_request',{shiftId:db.shiftAssignments[1].id,targetEmployeeId:3},t),/INVALID_DATE/);
 // valid request
 employeeAction(db,emp,'shift_swap_request',{shiftId:shift.id,targetEmployeeId:3},t);
 const req=db.shiftSwapRequests[0];
 assert.equal(req.status,'pending');assert.equal(req.day,'2026-10-21');
 // duplicate pending request blocked
 assert.throws(()=>employeeAction(db,emp,'shift_swap_request',{shiftId:shift.id,targetEmployeeId:3},t),/SWAP_CONFLICT/);
 // visibility: requester, target, same-scope manager see it; other branch does not
 assert.equal(visibleWorkspace(db,emp).shiftSwapRequests.length,1);
 assert.equal(visibleWorkspace(db,emp2).shiftSwapRequests.length,1);
 assert.equal(visibleWorkspace(db,mgr).shiftSwapRequests.length,1);
 assert.equal(visibleWorkspace(db,otherBranch).shiftSwapRequests.length,0);
 // employees cannot review; other-branch manager cannot review
 assert.throws(()=>employeeAction(db,emp,'shift_swap_review',{id:req.id,approved:true},t),/FORBIDDEN/);
 assert.throws(()=>employeeAction(db,otherBranch,'shift_swap_review',{id:req.id,approved:true},t),/FORBIDDEN/);
 // approve: atomic swap
 employeeAction(db,mgr,'shift_swap_review',{id:req.id,approved:true},t+1000);
 assert.equal(req.status,'approved');
 assert.equal(db.shiftAssignments[0].employeeId,3);
 assert.equal(db.shiftAssignments[0].employeeName,'Emp Two');
 assert.throws(()=>employeeAction(db,mgr,'shift_swap_review',{id:req.id,approved:false},t),/INVALID_STATE/);
 // conflict path: target picks up a shift that day after the request, approval fails and data is unchanged
 employeeAction(db,mgr,'shift_assign',{employeeId:1,day:'2026-10-22',start:'09:00',end:'17:00'},t);
 employeeAction(db,emp,'shift_swap_request',{shiftId:db.shiftAssignments[2].id,targetEmployeeId:3},t);
 employeeAction(db,mgr,'shift_assign',{employeeId:3,day:'2026-10-22',start:'09:00',end:'17:00'},t);
 const req2=db.shiftSwapRequests[1];
 assert.throws(()=>employeeAction(db,admin,'shift_swap_review',{id:req2.id,approved:true},t),/SWAP_CONFLICT/);
 assert.equal(db.shiftAssignments[2].employeeId,1);
 assert.equal(req2.status,'pending');
 // rejection path
 employeeAction(db,mgr,'shift_swap_review',{id:req2.id,approved:false,note:'اليوم ده محتاجينك'},t+2000);
 assert.equal(req2.status,'rejected');
 assert.equal(db.shiftAssignments[2].employeeId,1);
 // employees see colleagues list for picking a swap target
 const peers=visibleWorkspace(db,emp).shiftSwapPeers;
 assert.deepEqual(peers.map(p=>p.id).sort(),[2,3]);
});

test('point objections: employee objects once, manager accepts (voids) or rejects, scoping enforced',()=>{
 const {db,emp,mgr,otherBranch,admin}=seed();
 db.points.push({id:'pt1',employeeId:1,color:'red',source:'manual:mgr',amount:1,reason:'تأخير 30 دقيقة',at:new Date(t).toISOString(),ruleVersion:0});
 // not your point
 assert.throws(()=>employeeAction(db,{id:3,role:'employee',position:'كابتن',branch:'A',full_name:'Emp Two'},'point_object',{pointId:'pt1',reason:'مستعجل'},t),/FORBIDDEN/);
 employeeAction(db,emp,'point_object',{pointId:'pt1',reason:'الشفت كان متأخر بسبب زحمة الطريق والمدير عارف'},t);
 const obj=db.pointObjections[0];
 assert.equal(obj.status,'pending');
 assert.equal(obj.pointSummary.reason,'تأخير 30 دقيقة');
 // one open objection per point
 assert.throws(()=>employeeAction(db,emp,'point_object',{pointId:'pt1',reason:'تاني'},t),/OBJECTION_CONFLICT/);
 // unknown point
 assert.throws(()=>employeeAction(db,emp,'point_object',{pointId:'nope',reason:'x'},t),/FORBIDDEN/);
 // visibility
 assert.equal(visibleWorkspace(db,emp).pointObjections.length,1);
 assert.equal(visibleWorkspace(db,mgr).pointObjections.length,1);
 assert.equal(visibleWorkspace(db,otherBranch).pointObjections.length,0);
 // employee cannot review; other-branch manager cannot review
 assert.throws(()=>employeeAction(db,emp,'point_objection_review',{id:obj.id,approved:true,note:'x'},t),/FORBIDDEN/);
 assert.throws(()=>employeeAction(db,otherBranch,'point_objection_review',{id:obj.id,approved:true,note:'x'},t),/FORBIDDEN/);
 // manager rejects first
 employeeAction(db,mgr,'point_objection_review',{id:obj.id,approved:false,note:'التأخير مثبت في السيستم'},t+1000);
 assert.equal(obj.status,'rejected');
 assert.equal(db.points[0].voidedAt,undefined);
 // object again, admin accepts and voids the point
 employeeAction(db,emp,'point_object',{pointId:'pt1',reason:'فيه سوء تفاهم'},t+2000);
 employeeAction(db,admin,'point_objection_review',{id:db.pointObjections[1].id,approved:true,note:'اتراجعنا عن النقطة'},t+3000);
 assert.equal(db.pointObjections[1].status,'accepted');
 assert.ok(db.points[0].voidedAt);
 assert.match(db.points[0].voidReason,/اعتراض مقبول/);
 // voided point cannot be objected to again
 assert.throws(()=>employeeAction(db,emp,'point_object',{pointId:'pt1',reason:'ثالث'},t),/INVALID_STATE/);
});

test('announcements: targeting, scoping, ack once',()=>{
 const {db,emp,emp2,mgr,otherBranch,admin}=seed();
 // manager can post to own branch or own department only
 employeeAction(db,mgr,'announcement_create',{kind:'branch',branch:'A',title:'تنبيه',body:'الاجتماع بكرة 10 الصبح'},t);
 employeeAction(db,mgr,'announcement_create',{kind:'department',department:'التدريب',title:'تدريب',body:'فورم الجلسات الجديدة'},t);
 assert.throws(()=>employeeAction(db,mgr,'announcement_create',{kind:'all',title:'x',body:'y'},t),/FORBIDDEN/);
 assert.throws(()=>employeeAction(db,mgr,'announcement_create',{kind:'branch',branch:'B',title:'x',body:'y'},t),/FORBIDDEN/);
 assert.throws(()=>employeeAction(db,mgr,'announcement_create',{kind:'department',department:'السيلز',title:'x',body:'y'},t),/FORBIDDEN/);
 // admin can post to all and to a department in any branch
 employeeAction(db,admin,'announcement_create',{kind:'all',title:'عام',body:'تحديث النظام الليلة'},t);
 employeeAction(db,admin,'announcement_create',{kind:'department',branch:'B',department:'السيلز',title:'سيلز',body:'تارجت الشهر'},t);
 // employee cannot post
 assert.throws(()=>employeeAction(db,emp,'announcement_create',{kind:'branch',branch:'A',title:'x',body:'y'},t),/FORBIDDEN/);
 // targeting: emp (كابتن, A) sees branch-A + dept-training-A + all; not sales-B
 const empView=visibleWorkspace(db,emp);
 assert.equal(empView.announcements.length,3);
 const salesView=visibleWorkspace(db,otherBranch); // manager sales B
 assert.deepEqual(salesView.announcements.map(a=>a.title).sort(),['سيلز','عام']);
 // creator sees own announcements even if not targeted
 const mgrView=visibleWorkspace(db,mgr);
 assert.equal(mgrView.announcements.length,3);
 // ack once
 const target=empView.announcements[0];
 employeeAction(db,emp,'announcement_ack',{id:target.id},t+1000);
 assert.throws(()=>employeeAction(db,emp,'announcement_ack',{id:target.id},t+2000),/INVALID_STATE/);
 // cannot ack an announcement not targeted to you
 const salesAnn=db.announcements.find(a=>a.title==='سيلز');
 assert.throws(()=>employeeAction(db,emp,'announcement_ack',{id:salesAnn.id},t),/FORBIDDEN/);
 // ack visibility: creator (manager) sees acks on own announcements; employee sees own acks
 assert.equal(visibleWorkspace(db,mgr).announcementAcks.filter(k=>k.announcementId===String(target.id)).length,target.createdById===2?1:0);
 assert.equal(visibleWorkspace(db,emp).announcementAcks.length,1);
 // invalid input
 assert.throws(()=>employeeAction(db,admin,'announcement_create',{kind:'branch',branch:'X',title:'t',body:'b'},t),/INVALID_INPUT/);
 assert.throws(()=>employeeAction(db,admin,'announcement_create',{kind:'all',title:'',body:'b'},t),/INVALID_INPUT/);
});

test('availability: upsert own, scoped visibility',()=>{
 const {db,emp,emp2,mgr,otherBranch}=seed();
 employeeAction(db,emp,'availability_set',{weekdays:[0,2,4],note:'متاح الصبح بس'},t);
 assert.throws(()=>employeeAction(db,emp,'availability_set',{weekdays:[0,0]},t),/INVALID_INPUT/);
 assert.throws(()=>employeeAction(db,emp,'availability_set',{weekdays:[7]},t),/INVALID_INPUT/);
 assert.throws(()=>employeeAction(db,emp,'availability_set',{weekdays:'الأحد'},t),/INVALID_INPUT/);
 employeeAction(db,emp,'availability_set',{weekdays:[1,3]},t+1000);
 assert.equal(db.availabilities.length,1);
 assert.deepEqual(db.availabilities[0].weekdays,[1,3]);
 employeeAction(db,emp2,'availability_set',{weekdays:[6]},t);
 assert.equal(visibleWorkspace(db,emp).availabilities.length,1);
 assert.equal(visibleWorkspace(db,mgr).availabilities.length,2);
 assert.equal(visibleWorkspace(db,otherBranch).availabilities.length,0);
});

test('documents: manager scope, expiry validation, remove',()=>{
 const {db,emp,mgr,otherBranch,admin}=seed();
 employeeAction(db,mgr,'doc_add',{employeeId:1,type:'شهادة إسعافات أولية',expiry:'2026-12-31',note:'تجديد سنوي'},t);
 assert.equal(db.documents.length,1);
 assert.throws(()=>employeeAction(db,mgr,'doc_add',{employeeId:4,type:'x',expiry:'2026-12-31'},t),/FORBIDDEN/);
 assert.throws(()=>employeeAction(db,mgr,'doc_add',{employeeId:1,type:'x',expiry:'2026-13-01'},t),/INVALID_DATE/);
 assert.throws(()=>employeeAction(db,mgr,'doc_add',{employeeId:1,type:'x',expiry:'2026-02-30'},t),/INVALID_DATE/);
 assert.throws(()=>employeeAction(db,emp,'doc_add',{employeeId:1,type:'x',expiry:'2026-12-31'},t),/FORBIDDEN/);
 // visibility: employee sees own, manager sees dept+branch, other branch sees none, admin all
 assert.equal(visibleWorkspace(db,emp).documents.length,1);
 assert.equal(visibleWorkspace(db,mgr).documents.length,1);
 assert.equal(visibleWorkspace(db,otherBranch).documents.length,0);
 assert.equal(visibleWorkspace(db,admin).documents.length,1);
 // remove: other-branch manager cannot; owning-scope manager can
 assert.throws(()=>employeeAction(db,otherBranch,'doc_remove',{id:db.documents[0].id},t),/FORBIDDEN/);
 employeeAction(db,mgr,'doc_remove',{id:db.documents[0].id},t+1000);
 assert.equal(db.documents.length,0);
 assert.throws(()=>employeeAction(db,mgr,'doc_remove',{id:'nope'},t),/NOT_FOUND/);
});

test('branch reconciliation: main merges into Vodafone, Rakhawy labeled women branch, nothing lost',()=>{
 const payload={branches:[{name:'الفرع الرئيسي',lat:null,lng:null},{name:'فرع فودافون',lat:29.9631855,lng:32.5572978},{name:'فرع الرخاوي',lat:29.964248,lng:32.5560476}],
  staff:[{id:1,name:'سيد',branch:'الفرع الرئيسي',department:'التدريب'},{id:2,name:'منى',branch:'فرع الرخاوي',department:'السيلز'}],
  punches:[{id:1,employeeId:1,branch:'الفرع الرئيسي',in:'2026-10-19T06:00:00.000Z',out:'2026-10-19T14:00:00.000Z'},{id:2,employeeId:2,branch:'فرع الرخاوي',in:'2026-10-19T06:00:00.000Z',out:'2026-10-19T14:00:00.000Z'}],
  shiftAssignments:[{id:'s1',employeeId:1,branch:'الفرع الرئيسي',day:'2026-10-20',start:'09:00',end:'17:00'}],
  announcements:[{id:'a1',title:'t',body:'b',scope:{kind:'department',branch:'فرع الرخاوي',department:'السيلز'},createdById:9,createdAt:'2026-10-19T00:00:00.000Z'}]};
 const db=hydrateWorkspace(payload,[]);
 assert.deepEqual(db.branches.map(b=>b.name).sort(),['فرع الرخاوي — سيدات','فرع فودافون'].sort());
 assert.equal(db.staff.find(s=>s.id===1).branch,'فرع فودافون');
 assert.equal(db.staff.find(s=>s.id===2).branch,'فرع الرخاوي — سيدات');
 assert.equal(db.shiftAssignments[0].branch,'فرع فودافون');
 assert.equal(db.punches[0].branch,'فرع فودافون');
 assert.equal(db.punches[1].branch,'فرع الرخاوي — سيدات');
 assert.equal(db.announcements[0].scope.branch,'فرع الرخاوي — سيدات');
 // Vodafone branch keeps its GPS; women branch gets legacy GPS
 assert.equal(db.branches.find(b=>b.name==='فرع فودافون').lat,29.9631855);
 assert.equal(db.branches.find(b=>b.name==='فرع الرخاوي — سيدات').lat,29.964248);
 // idempotent
 const again=hydrateWorkspace(JSON.parse(JSON.stringify(db)),[]);
 assert.deepEqual(again.branches.map(b=>b.name).sort(),['فرع الرخاوي — سيدات','فرع فودافون'].sort());
});

test('branch chat: scoped to branch, trimmed to last 200',()=>{
 const {db,emp,mgr,otherBranch}=seed();
 employeeAction(db,emp,'chat_send',{body:'صباح الخير يا فريق'},t);
 employeeAction(db,mgr,'chat_send',{body:'الاجتماع اتنقل ١١'},t+1000);
 assert.equal(db.chatMessages.length,2);
 assert.equal(db.chatMessages[1].manager,true);
 assert.equal(db.chatMessages[0].manager,false);
 assert.equal(visibleWorkspace(db,emp).chatMessages.length,2);
 assert.equal(visibleWorkspace(db,otherBranch).chatMessages.length,0);
 assert.throws(()=>employeeAction(db,emp,'chat_send',{body:'   '},t),/INVALID_INPUT/);
 for(let i=0;i<205;i++)employeeAction(db,emp,'chat_send',{body:'رسالة '+i},t+2000+i);
 assert.equal(db.chatMessages.filter(m=>m.branch==='A').length,200);
 assert.equal(visibleWorkspace(db,emp).chatMessages.length,50);
});

test('open shifts: manager posts, employee claims, approval books the shift atomically',()=>{
 const {db,emp,emp2,mgr,otherBranch,admin}=seed();
 // only manager/admin can post
 assert.throws(()=>employeeAction(db,emp,'open_shift_create',{day:'2026-10-21',start:'09:00',end:'17:00'},t),/FORBIDDEN/);
 employeeAction(db,mgr,'open_shift_create',{day:'2026-10-21',start:'09:00',end:'17:00',graceMinutes:10},t);
 const o=db.openShifts[0];
 assert.equal(o.branch,'A');assert.equal(o.department,'التدريب');assert.equal(o.status,'open');
 // other branch manager cannot post outside scope
 assert.throws(()=>employeeAction(db,otherBranch,'open_shift_create',{day:'2026-10-21',start:'09:00',end:'17:00',branch:'A'},t),/FORBIDDEN/);
 // admin posts for any branch+department
 employeeAction(db,admin,'open_shift_create',{branch:'B',department:'السيلز',day:'2026-10-21',start:'14:00',end:'22:00'},t);
 // visibility: emp sees own dept open shift, not the sales one
 assert.equal(visibleWorkspace(db,emp).openShifts.length,1);
 assert.equal(visibleWorkspace(db,otherBranch).openShifts.length,1);
 // claim rules
 employeeAction(db,emp,'open_shift_claim',{id:o.id},t+1000);
 assert.throws(()=>employeeAction(db,emp,'open_shift_claim',{id:o.id},t+2000),/CONFLICT/);
 employeeAction(db,emp2,'open_shift_claim',{id:o.id},t+1000);
 // employee with a shift that day cannot claim
 employeeAction(db,mgr,'shift_assign',{employeeId:1,day:'2026-10-22',start:'09:00',end:'17:00'},t);
 employeeAction(db,mgr,'open_shift_create',{day:'2026-10-22',start:'18:00',end:'23:00'},t);
 assert.throws(()=>employeeAction(db,emp,'open_shift_claim',{id:db.openShifts.at(-1).id},t),/SHIFT_EXISTS/);
 // other-branch manager cannot review; employee cannot review
 const claim1=o.claims[0];
 assert.throws(()=>employeeAction(db,otherBranch,'open_shift_review',{id:o.id,claimId:claim1.id,approved:true},t),/FORBIDDEN/);
 assert.throws(()=>employeeAction(db,emp,'open_shift_review',{id:o.id,claimId:claim1.id,approved:true},t),/FORBIDDEN/);
 // approve: shift booked for claimer, others rejected
 employeeAction(db,mgr,'open_shift_review',{id:o.id,claimId:claim1.id,approved:true},t+3000);
 assert.equal(o.status,'filled');
 assert.equal(claim1.status,'approved');
 assert.equal(o.claims[1].status,'rejected');
 const booked=db.shiftAssignments.find(x=>Number(x.employeeId)===1&&x.day==='2026-10-21');
 assert.ok(booked);assert.equal(booked.graceMinutes,10);
 // reviewing a filled shift fails
 assert.throws(()=>employeeAction(db,mgr,'open_shift_review',{id:o.id,claimId:claim1.id,approved:true},t),/NOT_FOUND/);
});

test('kiosk PIN: manager sets and clears, uniqueness enforced, hash never leaks to employee views',()=>{
 const {db,emp,mgr,otherBranch}=seed();
 assert.throws(()=>employeeAction(db,mgr,'kiosk_pin_set',{employeeId:1,pin:'12'},t),/PIN_RULES/);
 assert.throws(()=>employeeAction(db,mgr,'kiosk_pin_set',{employeeId:1,pin:'12345a'},t),/PIN_RULES/);
 assert.throws(()=>employeeAction(db,emp,'kiosk_pin_set',{employeeId:1,pin:'2468'},t),/FORBIDDEN/);
 assert.throws(()=>employeeAction(db,otherBranch,'kiosk_pin_set',{employeeId:1,pin:'2468'},t),/FORBIDDEN/);
 employeeAction(db,mgr,'kiosk_pin_set',{employeeId:1,pin:'2468'},t);
 const target=db.staff.find(s=>s.id===1);
 assert.ok(target.pinHash);assert(!String(target.pinHash).includes('2468'));
 // uniqueness
 employeeAction(db,mgr,'kiosk_pin_set',{employeeId:3,pin:'1357'},t);
 assert.throws(()=>employeeAction(db,mgr,'kiosk_pin_set',{employeeId:2,pin:'2468'},t),/PIN_TAKEN/);
 // visibility: employee view never carries pinHash
 assert(!JSON.stringify(visibleWorkspace(db,emp).staff).includes('pinHash'));
 assert(!JSON.stringify(visibleWorkspace(db,mgr).staff).includes('pinHash'));
 // findStaffByPin resolves branch-scoped
 assert.equal(findStaffByPin(db,'A','2468').id,1);
 assert.equal(findStaffByPin(db,'B','2468'),null);
 assert.equal(findStaffByPin(db,'A','0000'),null);
 // kiosk punch flow without GPS
 kioskPunch(db,target,'in',t+86400000);
 assert.equal(db.punches[0].source,'kiosk');
 assert.throws(()=>kioskPunch(db,target,'in',t+86400000+1000),/ALREADY_CHECKED_IN/);
 kioskPunch(db,target,'out',t+86400000+8*36e5);
 assert.ok(db.punches[0].out);
 assert.throws(()=>kioskPunch(db,target,'out',t+86400000+9*36e5),/NO_OPEN_SHIFT/);
 assert.throws(()=>kioskPunch(db,target,'side',t),/INVALID_INPUT/);
 // clear PIN
 employeeAction(db,mgr,'kiosk_pin_clear',{employeeId:1},t+2000);
 assert.equal(db.staff.find(s=>s.id===1).pinHash,undefined);
});

test('chat rooms: branch room and all-staff room, admin picks branch, per-room trim',()=>{
 const {db,emp,emp2,mgr,otherBranch,admin}=seed();
 employeeAction(db,emp,'chat_send',{body:'رسالة الفرع',room:'branch'},t);
 employeeAction(db,mgr,'chat_send',{body:'رسالة عامة',room:'all'},t+1000);
 // everyone sees the all-staff room; branch room only for own branch
 assert.equal(visibleWorkspace(db,emp).chatMessages.length,2);
 assert.equal(visibleWorkspace(db,otherBranch).chatMessages.length,1);
 assert.equal(visibleWorkspace(db,otherBranch).chatMessages[0].body,'رسالة عامة');
 // branch room posts land on own branch only
 employeeAction(db,otherBranch,'chat_send',{body:'شات فرع B',room:'branch'},t+2000);
 assert.equal(visibleWorkspace(db,otherBranch).chatMessages.length,2);
 assert.equal(visibleWorkspace(db,emp).chatMessages.length,2);
 // admin posts to a chosen branch room; invalid branch rejected
 employeeAction(db,admin,'chat_send',{body:'إداري لفرع A',room:'branch',branch:'A'},t+3000);
 assert.equal(visibleWorkspace(db,emp).chatMessages.length,3);
 assert.throws(()=>employeeAction(db,admin,'chat_send',{body:'x',room:'branch',branch:'Nowhere'},t),/INVALID_INPUT/);
 // room value other than 'all' stays a branch room
 employeeAction(db,emp,'chat_send',{body:'default branch',room:'whatever'},t+4000);
 assert.equal(db.chatMessages.at(-1).room,'branch');
});

test('kiosk toggle is admin-only and flips the flag',()=>{
 const {db,mgr,admin}=seed();
 assert.equal(db.rules.kioskEnabled,false);
 assert.throws(()=>employeeAction(db,mgr,'kiosk_toggle',{enabled:true},t),/FORBIDDEN/);
 employeeAction(db,admin,'kiosk_toggle',{enabled:true},t);
 assert.equal(db.rules.kioskEnabled,true);
 employeeAction(db,admin,'kiosk_toggle',{enabled:false},t+1000);
 assert.equal(db.rules.kioskEnabled,false);
});
