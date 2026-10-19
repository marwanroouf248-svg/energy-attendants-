import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
process.env.NODE_ENV='test';process.env.PUBLIC_ORIGIN='http://localhost:3000';process.env.INITIAL_ADMIN_EMAIL='owner@example.test';process.env.ADMIN_SETUP_TOKEN='test-setup-token-'.repeat(3);
const {server,injectTestStore}=await import('../server/index.mjs');
const digestPin=v=>createHash('sha256').update(String(v)).digest('hex');
const users=[],sessions=new Map(),limits=new Map(),states=new Map([['workspace',{payload:JSON.stringify({branches:[{name:'A',lat:null,lng:null}],staff:[{id:-1,name:'Legacy',email:'legacy@example.test',branch:'A',position:'كابتن',department:'التدريب',pinHash:digestPin('246810')}],rules:{kioskEnabled:true}}),revision:0}]]);
const fake={async q(sql,p=[]){
 if(sql.startsWith('SELECT payload,revision FROM es_state'))return [states.get('workspace')];
 if(sql.startsWith('UPDATE es_state SET payload=')){const row=states.get('workspace');if(row.revision!==p[1])return {affectedRows:0};row.payload=p[0];row.revision++;return {affectedRows:1}}
 if(sql.includes("FROM es_users WHERE status='approved'"))return [];
 if(sql.startsWith('INSERT INTO es_limits')){limits.set(p[0],(limits.get(p[0])||0)+1);return {affectedRows:1}}
 if(sql.startsWith('SELECT attempts FROM es_limits'))return [{attempts:limits.get(p[0])}];
 if(sql.startsWith('INSERT INTO es_audit'))return {insertId:1};
 throw Error('Unexpected test SQL: '+sql);
 },async transaction(fn){return fn(this)}};
await injectTestStore(fake);
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const post=body=>fetch(base+'/api/kiosk/punch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(async r=>({status:r.status,data:await r.json()}));
test('kiosk punch: PIN-only punch in/out at a branch, generic failure, no session',async()=>{
 try{
  const saved2=states.get('workspace'),offState=JSON.parse(saved2.payload);offState.rules.kioskEnabled=false;saved2.payload=JSON.stringify(offState);
  const offTry=await post({branch:'A',pin:'246810',direction:'in'});assert.equal(offTry.status,403);assert.equal(offTry.data.error,'KIOSK_OFF');
  const onState=JSON.parse(saved2.payload);onState.rules.kioskEnabled=true;saved2.payload=JSON.stringify(onState);
  const badBranch=await post({branch:'Nowhere',pin:'246810',direction:'in'});assert.equal(badBranch.status,400);assert.equal(badBranch.data.error,'KIOSK_FAILED');
  const badPin=await post({branch:'A',pin:'000000',direction:'in'});assert.equal(badPin.data.error,'KIOSK_FAILED');
  const badShape=await post({branch:'A',pin:'12',direction:'in'});assert.equal(badShape.data.error,'KIOSK_FAILED');
  const badDirection=await post({branch:'A',pin:'246810',direction:'side'});assert.equal(badDirection.data.error,'KIOSK_FAILED');
  const punchIn=await post({branch:'A',pin:'246810',direction:'in'});assert.equal(punchIn.status,200);assert.equal(punchIn.data.name,'Legacy');
  const again=await post({branch:'A',pin:'246810',direction:'in'});assert.equal(again.data.error,'ALREADY_CHECKED_IN');
  const punchOut=await post({branch:'A',pin:'246810',direction:'out'});assert.equal(punchOut.status,200);
  const saved=JSON.parse(states.get('workspace').payload);
  assert.equal(saved.punches.length,1);assert.equal(saved.punches[0].source,'kiosk');assert.ok(saved.punches[0].out);
  assert(!JSON.stringify(saved).includes('246810'));
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
