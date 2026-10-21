import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace, employeeAction, findStaffByPin, allowedBranches} from '../server/domain.mjs';
import {createHash} from 'node:crypto';

const A={name:'فرع فودافون',lat:30.0444,lng:31.2357};
const B={name:'فرع الرخاوي',lat:30.0500,lng:31.2400};
const coordsA={latitude:30.0444,longitude:31.2357,accuracy:10};
const coordsB={latitude:30.0500,longitude:31.2400,accuracy:10};
function ws(access){const db=emptyWorkspace();db.branches=[A,B];db.staff=[{id:7,name:'أحمد',department:'التدريب',branch:'فرع فودافون',position:'كابتن',...(access?{branchAccess:access}:{})}];return db}
const emp={id:7,role:'employee',full_name:'أحمد',position:'كابتن',branch:'فرع فودافون'};

test('default: own branch only — punch at other branch rejected',()=>{
  const db=ws();
  employeeAction(db,emp,'punch_in',{coords:coordsA});
  assert.equal(db.punches[0].atBranch,'فرع فودافون');
  const db2=ws();
  assert.throws(()=>employeeAction(db2,emp,'punch_in',{coords:coordsB}),/OUTSIDE_80_METERS/);
});
test('both: punch succeeds at either branch and records actual branch',()=>{
  const db=ws('both');
  employeeAction(db,emp,'punch_in',{coords:coordsB});
  assert.equal(db.punches.length,1);
  assert.equal(db.punches[0].branch,'فرع فودافون');
  assert.equal(db.punches[0].atBranch,'فرع الرخاوي');
});
test('any: allowedBranches returns all located branches',()=>{
  const db=ws('any');
  assert.equal(allowedBranches(db,db.staff[0]).length,2);
  assert.equal(allowedBranches(ws(),ws().staff[0]).length,1);
});
test('kiosk PIN matches at second branch only with dual access',()=>{
  const pin='246810',h=createHash('sha256').update(pin).digest('hex');
  const db=ws();db.staff[0].pinHash=h;
  assert.equal(findStaffByPin(db,'فرع الرخاوي',pin),null);
  db.staff[0].branchAccess='both';
  assert.equal(findStaffByPin(db,'فرع الرخاوي',pin).id,7);
  assert.equal(findStaffByPin(db,'فرع فودافون',pin).id,7);
});
