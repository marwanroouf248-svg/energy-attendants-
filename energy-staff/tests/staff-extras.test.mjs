import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorkspace,employeeAction,visibleWorkspace,positions} from '../server/domain.mjs';

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
