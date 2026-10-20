import test from 'node:test';import assert from 'node:assert/strict';
import {defaultAssessors,seedAssessors,validSlotTime} from '../server/domain.mjs';
test('confirmed schedules apply once as 30-minute slots and keep manual edits',()=>{
 const db={assessors:defaultAssessors(),assessorsSeeded:true,assessmentBookings:[{id:1}]};
 seedAssessors(db);const by=id=>db.assessors.find(a=>a.id===id).availability;
 assert.deepEqual(by('asr-yassin')['0'],['21:00','21:30','22:00']);assert.deepEqual(Object.keys(by('asr-yassin')),['0','2','4','5']);
 assert.equal(by('asr-hesham')['6'].at(-1),'22:30');assert.equal(by('asr-laila')['1'][0],'17:00');assert.equal(by('asr-laila')['1'].at(-1),'20:30');
 assert.deepEqual(by('asr-hana')['2'],['12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30']);
 for(const a of db.assessors)for(const v of Object.values(a.availability))for(const t of v)assert.ok(validSlotTime(t));
 db.assessors[0].availability={'1':['10:00']};seedAssessors(db);assert.deepEqual(db.assessors[0].availability,{'1':['10:00']});assert.equal(db.assessmentBookings.length,1);
});
