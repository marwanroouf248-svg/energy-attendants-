// Share one initialization attempt; recover on a later request after a brief cooldown.
export function createConnection(factory,{cooldown=5000,now=Date.now,onError=()=>{}}={}){
 let resource,pending,lastAttempt=-Infinity;
 return {async ready(){
  if(resource)return resource;
  if(pending)return pending;
  if(now()-lastAttempt<cooldown)return undefined;
  lastAttempt=now();
  pending=Promise.resolve().then(factory).then(value=>resource=value).catch(error=>{onError(error);return undefined}).finally(()=>{pending=null});
  return pending;
 }};
}
