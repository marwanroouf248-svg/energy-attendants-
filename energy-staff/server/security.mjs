import {randomBytes,scrypt as derive,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {isIP} from 'node:net';
export function clientAddress(req,onVercel=false){
 const forwarded=onVercel?String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||'').slice(0,512).split(',')[0].trim():'';
 return isIP(forwarded)?forwarded:String(req.socket?.remoteAddress||'unknown');
}
const scrypt=promisify(derive);
export const digest=s=>createHash('sha256').update(String(s)).digest('hex');
export const randomToken=()=>randomBytes(32).toString('hex');
export function safeEqual(a,b){return timingSafeEqual(Buffer.from(digest(a),'hex'),Buffer.from(digest(b),'hex'))}
export function passwordValid(p){return typeof p==='string'&&p.length>=10&&p.length<=128&&/[\p{L}]/u.test(p)&&/[0-9٠-٩]/.test(p)}
export async function hashPassword(password){if(!passwordValid(password))throw Error('PASSWORD_RULES');const salt=randomBytes(16).toString('hex'),key=await scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});return ['scrypt',32768,8,3,salt,key.toString('hex')].join('$')}
export async function checkPassword(password,stored){try{if(typeof password!=='string'||password.length>128)return false;const [scheme,N,r,p,salt,hash]=stored.split('$');if(scheme!=='scrypt'||N!=='32768'||r!=='8'||p!=='3'||!salt||hash?.length!==128)return false;const key=await scrypt(password,salt,64,{N:Number(N),r:Number(r),p:Number(p),maxmem:64*1024*1024});return timingSafeEqual(key,Buffer.from(hash,'hex'))}catch{return false}}
export function cookieSession(req){const cookies=String(req.headers.cookie||'').split(';').map(s=>s.trim());const val=cookies.find(s=>s.startsWith('__Host-energy_session='))||cookies.find(s=>s.startsWith('energy_session='));return val?val.slice(val.indexOf('=')+1):''}
export function sessionCookie(token,production=true,clear=false){return `${production?'__Host-energy_session':'energy_session'}=${clear?'':token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${clear?0:43200}${production?'; Secure':''}`}
export function requireCsrf(req,session,origin){if(!session||!safeEqual(req.headers['x-csrf-token']||'',session.csrf))throw Error('CSRF');if(req.headers.origin&&req.headers.origin!==origin)throw Error('ORIGIN')}
