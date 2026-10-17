import {server} from '../server/index.mjs';

// Reuse the same authorization and MySQL API on Vercel and a Node host.
export const config={api:{bodyParser:false}};
export default function handler(req,res){
 const url=new URL(req.url,'http://localhost');
 const route=url.searchParams.get('route');
 if(route!==null){url.searchParams.delete('route');req.url='/api/'+route+(url.searchParams.size?'?'+url.searchParams:'');}
 return server.listeners('request')[0](req,res);
}
