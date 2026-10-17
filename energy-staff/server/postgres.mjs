import {readFile} from 'node:fs/promises';
// Compatibility for the application's bounded, parameterized SQL statements.
// Credentials belong to a dedicated login role restricted to energy_staff_v3.
export function postgresStatement(sql){
 if(sql.startsWith('INSERT INTO es_limits'))return `INSERT INTO energy_staff_v3.es_limits(limit_key,attempts,resets_at) VALUES($1,1,now()+$2*interval '1 minute') ON CONFLICT(limit_key) DO UPDATE SET attempts=CASE WHEN es_limits.resets_at<now() THEN 1 ELSE es_limits.attempts+1 END,resets_at=CASE WHEN es_limits.resets_at<now() THEN EXCLUDED.resets_at ELSE es_limits.resets_at END`;
 let i=0;
 let statement=sql.replace(/DATE_ADD\(UTC_TIMESTAMP\(\),INTERVAL 12 HOUR\)/g,"(now()+interval '12 hours')").replace(/UTC_TIMESTAMP\(\)/g,'now()').replace(/\bes_(users|sessions|limits|state|audit)\b/g,'energy_staff_v3.es_$1').replace(/\?/g,()=>'$'+(++i));
 if(/^INSERT INTO energy_staff_v3\.es_users\b/.test(statement))statement+=' RETURNING id';
 return statement;
}
export async function createPostgresStore(env=process.env){
 const {default:pg}=await import('pg');
 const ca=await readFile(new URL('./supabase-ca.crt',import.meta.url),'utf8');
 const pool=new pg.Pool({connectionString:env.DATABASE_URL,max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true,ca},application_name:'energy-staff-vercel'});
 pool.on('error',()=>console.error('Energy Staff: idle database connection closed.'));
 async function query(client,sql,params=[]){
  try{const result=await client.query(postgresStatement(sql),params);
   return /^(SELECT|WITH)\b/.test(sql)?result.rows:{affectedRows:result.rowCount,insertId:result.rows[0]?.id};
  }catch(e){if(e.code==='23505')e.code='ER_DUP_ENTRY';throw e}
 }
 await pool.query('SELECT state_key FROM energy_staff_v3.es_state LIMIT 1');
 return {kind:'postgres',q:(sql,args)=>query(pool,sql,args),async transaction(fn){const conn=await pool.connect();try{await conn.query('BEGIN');const result=await fn({q:(sql,args)=>query(conn,sql,args)});await conn.query('COMMIT');return result}catch(e){await conn.query('ROLLBACK');throw e}finally{conn.release()}},close:()=>pool.end()};
}
