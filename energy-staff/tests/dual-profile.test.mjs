import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,profileUser,myProfiles,employeeAction,visibleWorkspace} from '../server/domain.mjs';

function seed(){
  const db=emptyWorkspace();
  db.branches.push({name:'فرع فودافون'},{name:'فرع الرخاوي — سيدات'});
  db.staff.push(
    {id:7,name:'هنا',position:'إتش آر',department:'الموارد البشرية',branch:'فرع الرخاوي — سيدات',cloudId:'7',email:'hana@x.com'},
    {id:70,name:'هنا — أسسمنت',position:'أسسمنت — دكتور علاج طبيعي',department:'الأسسمنت والعلاج الطبيعي',branch:'فرع الرخاوي — سيدات'}
  );
  db.profileLinks={'7':[70]};
  return db;
}
const hana={id:7,role:'employee',full_name:'هنا',position:'إتش آر',branch:'فرع الرخاوي — سيدات'};

test('profileUser substitutes a linked profile row',()=>{
  const db=seed();
  const pu=profileUser(db,hana,'70');
  assert.equal(pu.id,70);assert.equal(pu.position,'أسسمنت — دكتور علاج طبيعي');assert.equal(pu.profileOf,7);
});
test('profileUser returns user unchanged without as, null for unlinked or unknown',()=>{
  const db=seed();
  assert.equal(profileUser(db,hana,null),hana);
  assert.equal(profileUser(db,hana,''),hana);
  assert.equal(profileUser(db,hana,'3'),null);
  assert.equal(profileUser(db,hana,'999'),null);
});
test('myProfiles lists primary + linked profiles',()=>{
  const db=seed();
  const ps=myProfiles(db,hana);
  assert.equal(ps.length,2);assert.equal(ps[0].primary,true);assert.equal(ps[1].id,70);
});
test('actions run under the substituted profile identity',()=>{
  const db=seed();
  const pu=profileUser(db,hana,'70');
  employeeAction(db,pu,'request_create',{type:'إجازة اعتيادية',detail:'ظرف',day:'2026-10-25'},'2026-10-21T08:00:00Z');
  const r=db.requests.at(-1);
  assert.equal(Number(r.employeeId),70);assert.equal(r.name,'هنا — أسسمنت');
});
test('visibleWorkspace treats substituted profile as assessment doctor',()=>{
  const db=seed();
  db.assessmentBookings.push({id:1,branch:'فرع الرخاوي — سيدات',doctorId:70,doctorName:'هنا — أسسمنت',day:'2026-10-22',time:'10:00',patientName:'x',phone:'1',bookingStatus:'مؤكد',createdBy:'س',createdAt:'2026-10-21T00:00:00Z'});
  const pu=profileUser(db,hana,'70');
  const out=visibleWorkspace(db,pu);
  assert.equal(out.assessmentBookings.length,1);
  const out2=visibleWorkspace(db,hana);
  assert.equal(out2.assessmentBookings.length,0);
});
