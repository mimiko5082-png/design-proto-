// Local integration server using the same Worker handler and a persistent SQLite DB.
import http from 'node:http';
import { handleRequest } from '../ai-service/worker.mjs';
import { sharingEnvironment } from './helpers/sharing-db.mjs';
const env=sharingEnvironment();env.ALLOWED_ORIGIN=process.argv[2];
const server=http.createServer(async(req,res)=>{
 try{
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>450*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  const response=await handleRequest(new Request('https://worker.test'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),env);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('{}');}
});
server.listen(0,'127.0.0.1',()=>process.stdout.write(JSON.stringify({port:server.address().port})+'\n'));
