import test from 'node:test';import assert from 'node:assert/strict';
import {emptyWorkspace,employeeAction,visibleWorkspace,positions} from '../server/domain.mjs';
const A='فرع فودافون',B='فرع الرخاوي — سيدات';
function seed(){
 const db=emptyWorkspace();
 db.branches=[{name:A,lat:30,lng:31},{name:B,lat:32,lng:33}];
 db.staff=[
  {id:1,name:'Admin',position:'كابتن',department:positions['كابتن'],branch:A},
  {id:2,name:'Cap A',position:'كابتن',department:positions['كابتن'],branch:A},
  {id:3,name:'Cap B',position:'كابتن',department:positions['كابتن'],branch:B}];
 return {db,
  admin:{id:1,role:'admin',position:'كابتن',branch:A,full_name:'Admin'},
  empA:{id:2,role:'employee',position:'كابتن',branch:A,full_name:'Cap A'},
  empB:{id:3,role:'employee',position:'كابتن',branch:B,full_name:'Cap B'}};
}
const t=Date.parse('2026-10-23T13:00:00Z');

test('general-room message reaches employees in both branches',()=>{
 const {db,admin,empA,empB}=seed();
 employeeAction(db,admin,'chat_send',{room:'all',body:'إعلان للكل'},t);
 const wa=visibleWorkspace(db,empA),wb=visibleWorkspace(db,empB);
 assert.equal(wa.chatMessages.filter(m=>m.room==='all').length,1);
 assert.equal(wb.chatMessages.filter(m=>m.room==='all').length,1);
 assert.equal(wa.chatMessages[0].body,'إعلان للكل');
 assert.equal(wa.chatMessages[0].branch,null);
});

test('branch-room message stays inside its branch and general room stays separate',()=>{
 const {db,admin,empA,empB}=seed();
 employeeAction(db,admin,'chat_send',{room:'branch',branch:A,body:'شات فرع A'},t);
 employeeAction(db,empB,'chat_send',{room:'branch',body:'شات فرع B'},t+1000);
 const wa=visibleWorkspace(db,empA),wb=visibleWorkspace(db,empB);
 assert.deepEqual(wa.chatMessages.map(m=>m.body),['شات فرع A']);
 assert.deepEqual(wb.chatMessages.map(m=>m.body),['شات فرع B']);
 assert.equal(wa.chatMessages[0].branch,A);
 assert.equal(wb.chatMessages[0].branch,B);
});

test('employee branch messages are attributed to their account branch',()=>{
 const {db,empB}=seed();
 employeeAction(db,empB,'chat_send',{room:'branch',body:'من موظف B'},t);
 const adminView=visibleWorkspace(db,{id:1,role:'admin',position:'كابتن',branch:A,full_name:'Admin'});
 assert.equal(adminView.chatMessages[0].branch,B);
});
