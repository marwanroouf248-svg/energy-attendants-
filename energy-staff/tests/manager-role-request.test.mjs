import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace, employeeAction} from '../server/domain.mjs';

function ws(){const db=emptyWorkspace();db.branches=[{name:'فرع فودافون'},{name:'فرع الرخاوي'}];db.staff=[{id:7,name:'أحمد كابتن',department:'التدريب',branch:'فرع فودافون',position:'كابتن'}];return db}
const emp={id:7,role:'employee',full_name:'أحمد كابتن',position:'كابتن',branch:'فرع فودافون'};
const mgr={id:7,role:'manager',full_name:'أحمد كابتن',position:'كابتن',branch:'فرع فودافون'};

test('employee files one manager access request',()=>{
  const db=ws();
  employeeAction(db,emp,'manager_role_request',{department:'الجودة',branch:'فرع فودافون'},'2026-10-21T08:00:00Z');
  const r=db.managerRequests[0];
  assert.equal(r.status,'pending');assert.equal(r.department,'الجودة');assert.equal(r.name,'أحمد كابتن');
  assert.throws(()=>employeeAction(db,emp,'manager_role_request',{department:'الجودة',branch:'فرع فودافون'}),/INVALID_STATE/);
});
test('rejects unknown department, unknown branch, and non-employee roles',()=>{
  const db=ws();
  assert.throws(()=>employeeAction(db,emp,'manager_role_request',{department:'قسم وهمي',branch:'فرع فودافون'}),/INVALID_INPUT/);
  assert.throws(()=>employeeAction(db,emp,'manager_role_request',{department:'الجودة',branch:'فرع وهمي'}),/INVALID_INPUT/);
  assert.throws(()=>employeeAction(db,mgr,'manager_role_request',{department:'الجودة',branch:'فرع فودافون'}),/FORBIDDEN/);
});
test('after rejection the employee can request again',()=>{
  const db=ws();
  employeeAction(db,emp,'manager_role_request',{department:'الجودة',branch:'فرع فودافون'});
  db.managerRequests[0].status='rejected';
  employeeAction(db,emp,'manager_role_request',{department:'الهاوس كيبنج',branch:'فرع الرخاوي'});
  assert.equal(db.managerRequests.length,2);
  assert.equal(db.managerRequests[1].department,'الهاوس كيبنج');
});
