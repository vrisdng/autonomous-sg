// Test-only Supabase RPC adapter over local PostgreSQL. Never deployed.
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile, readdir } from 'node:fs/promises';
const db=new PGlite({extensions:{pgcrypto}});
await db.exec(`create role anon; create role authenticated; create role service_role; create schema extensions; create schema realtime; create function realtime.send(jsonb,text,text,boolean) returns void language sql as 'select';`);
for(const name of (await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(`supabase/migrations/${name}`,'utf8'));
await db.exec('set role anon');
http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:8082');
 res.setHeader('Access-Control-Allow-Headers','apikey,authorization,content-type');
 if(req.method==='OPTIONS'){res.end();return;}
 if(req.method!=='POST'||!/^\/rest\/v1\/rpc\/[a-z_]+$/.test(req.url??'')){res.writeHead(404);res.end();return;}
 try{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const body=JSON.parse(Buffer.concat(chunks).toString());
  const entries=Object.entries(body);
  if(entries.some(([key])=>!/^p_[a-z_]+$/.test(key)))throw new Error('Invalid RPC argument');
  const name=req.url.split('/').at(-1);
  const args=entries.map(([key],index)=>`${key} => $${index+1}`).join(',');
  const values=entries.map(([,value])=>value&&typeof value==='object'?JSON.stringify(value):value);
  const data=await db.query(`select public.${name}(${args}) as result`,values);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data.rows[0].result));
 }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message}));}
}).listen(8790,'127.0.0.1',()=>console.log('Test PostgreSQL RPC service on 8790 (isolated; no real accounts).'));
