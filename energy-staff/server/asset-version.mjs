import {createHash} from 'node:crypto';
// Single source of truth for static-asset version tokens.
// The server only marks a ?v= URL immutable when v equals the file's live content token,
// so a changed file can never silently keep an immutable cached URL.
export function contentToken(bytes){return createHash('sha1').update(bytes).digest('hex').slice(0,10)}
