import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnection} from '../server/connection.mjs';
test('database initialization recovers after a transient outage without duplicate attempts',async()=>{
 let time=0,attempts=0,errors=0;const resource={connected:true};
 const c=createConnection(async()=>{attempts++;if(attempts===1)throw Error('Temporary outage');return resource},{cooldown:5000,now:()=>time,onError:()=>errors++});
 assert.deepEqual(await Promise.all([c.ready(),c.ready()]),[undefined,undefined]);assert.equal(attempts,1);assert.equal(errors,1);
 time=4999;assert.equal(await c.ready(),undefined);assert.equal(attempts,1);
 time=5000;assert.deepEqual(await Promise.all([c.ready(),c.ready()]),[resource,resource]);assert.equal(attempts,2);
 time=20000;assert.equal(await c.ready(),resource);assert.equal(attempts,2);
});
