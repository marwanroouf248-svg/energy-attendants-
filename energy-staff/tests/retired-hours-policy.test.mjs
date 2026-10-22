import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultPolicy,defaultLatePolicy,hydrateWorkspace,emptyWorkspace} from '../server/domain.mjs';
test('default policy has no minimum hours or premium overtime clauses',()=>{
 assert.doesNotMatch(JSON.stringify(defaultPolicy()),/210|1\.5|لا يُحتسب حافز/);
 for(const k of ['minMonthlyHours','overtimeThresholdHours','overtimeMultiplier','belowThresholdNoIncentive'])assert.equal(k in defaultLatePolicy(),false);
});
test('saved legacy policy is cleaned without changing payroll or attendance',()=>{
 const db=emptyWorkspace();
 db.policy={version:8,sections:[{title:'الأذونات وخصومات التأخير والحد الأدنى لساعات الشهر',body:'الغياب يوم بدون إذن = خصم يومين. الحد الأدنى لساعات العمل الشهرية لكل العاملين — سواء براتب أساسي أو بنظام الشيفتات — 210 ساعة عمل. الساعات فوق 210 ساعة في الشهر تُحتسب ساعات إضافية بـ 1.5 من سعر الساعة الأساسية. وأقل من 210 ساعة يُعتبر حجم عمل أقل من الأساسي ولا يُحتسب حافز.'},{title:'خاص',body:'نص مخصص محفوظ'}]};
 db.latePolicy={...defaultLatePolicy(),minMonthlyHours:210,overtimeMultiplier:1.5,overtimeThresholdHours:210,belowThresholdNoIncentive:true};
 db.punches=[{id:'p',employeeId:999,in:'2026-10-20T09:00:00Z',out:'2026-10-20T17:00:00Z'}];db.payrollDrafts={999:{bonus:'0'}};
 const out=hydrateWorkspace(db,[]);
 assert.equal(out.policy.sections[0].title,'الأذونات وخصومات التأخير');
 assert.equal(out.policy.sections[0].body,'الغياب يوم بدون إذن = خصم يومين.');
 assert.equal(out.policy.sections[1].body,'نص مخصص محفوظ');
 assert.equal('minMonthlyHours' in out.latePolicy,false);assert.equal('overtimeMultiplier' in out.latePolicy,false);
 assert.deepEqual(out.punches,db.punches);assert.deepEqual(out.payrollDrafts,db.payrollDrafts);
 assert.equal(out.latePolicy.active,false);
});
test('policy UI no longer exposes retired fields and payroll has no threshold logic',async()=>{
 const ui=await readFile(new URL('../dist/policy.js',import.meta.url),'utf8');
 assert.doesNotMatch(ui,/minMonthlyHours|overtimeThresholdHours|overtimeMultiplier|belowThresholdNoIncentive|210/);
 const payroll=await readFile(new URL('../dist/payroll.js',import.meta.url),'utf8');
 assert.doesNotMatch(payroll,/minMonthlyHours|overtimeThresholdHours|overtimeMultiplier|belowThresholdNoIncentive/);
});
