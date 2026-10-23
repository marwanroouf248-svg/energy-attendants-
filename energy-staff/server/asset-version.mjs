import {createHash} from 'node:crypto';
// Single source of truth for static-asset version tokens.
// The server only marks a ?v= URL immutable when v equals the file's live content token,
// so a changed file can never silently keep an immutable cached URL.
export function contentToken(bytes){return createHash('sha1').update(bytes).digest('hex').slice(0,10)}
// Token stamped into index.html / kiosk.html by scripts/stamp-version.mjs: covers exactly the
// local js/css files that html references, so any asset byte change changes the token.
export function stampToken(namedBytes){const h=createHash('sha1');for(const {name,bytes} of namedBytes){h.update(name);h.update('\0');h.update(bytes);h.update('\0')}return h.digest('hex').slice(0,10)}
