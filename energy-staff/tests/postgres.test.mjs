import test from 'node:test';
import assert from 'node:assert/strict';
import {postgresStatement} from '../server/postgres.mjs';

test('Postgres adapter parameterizes values and scopes app tables',()=>{
 assert.equal(postgresStatement('SELECT * FROM es_users WHERE email=?'), 'SELECT * FROM energy_staff_v3.es_users WHERE email=$1');
 assert.equal(postgresStatement("SELECT payload,revision FROM es_state WHERE state_key='workspace' FOR UPDATE"),"SELECT payload,revision FROM energy_staff_v3.es_state WHERE state_key='workspace' FOR UPDATE");
 const session=postgresStatement('INSERT INTO es_sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 12 HOUR))');
 assert.match(session,/\$1,\$2,\$3/);assert.match(session,/12 hours/);assert(!session.includes('UTC_TIMESTAMP'));
 assert.match(postgresStatement('INSERT INTO es_users(email) VALUES(?)'),/RETURNING id$/);
 const limited=postgresStatement('INSERT INTO es_limits');assert.match(limited,/ON CONFLICT\(limit_key\)/);assert.match(limited,/es_limits.attempts\+1/);
});
