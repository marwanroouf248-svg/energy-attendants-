import test from 'node:test';
import assert from 'node:assert/strict';
import {postgresStatement} from '../server/postgres.mjs';
import {clientAddress} from '../server/security.mjs';

test('serverless IP handling tolerates absent sockets and trusts proxy only on Vercel',()=>{
 const req={headers:{'x-forwarded-for':'192.0.2.1'}};
 assert.equal(clientAddress(req),'unknown');assert.equal(clientAddress(req,true),'192.0.2.1');
 assert.equal(clientAddress({headers:{},socket:{remoteAddress:'127.0.0.1'}}),'127.0.0.1');
 assert.equal(clientAddress({headers:{'x-forwarded-for':'spoofed'}},true),'unknown');
});

test('Postgres adapter parameterizes values and scopes app tables',()=>{
 assert.equal(postgresStatement('SELECT * FROM es_users WHERE email=?'), 'SELECT * FROM energy_staff_v3.es_users WHERE email=$1');
 assert.equal(postgresStatement("SELECT payload,revision FROM es_state WHERE state_key='workspace' FOR UPDATE"),"SELECT payload,revision FROM energy_staff_v3.es_state WHERE state_key='workspace' FOR UPDATE");
 const session=postgresStatement('INSERT INTO es_sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 12 HOUR))');
 assert.match(session,/\$1,\$2,\$3/);assert.match(session,/12 hours/);assert(!session.includes('UTC_TIMESTAMP'));
 assert.match(postgresStatement('INSERT INTO es_users(email) VALUES(?)'),/RETURNING id$/);
 const limited=postgresStatement('INSERT INTO es_limits');assert.match(limited,/ON CONFLICT\(limit_key\)/);assert.match(limited,/es_limits.attempts\+1/);
});
