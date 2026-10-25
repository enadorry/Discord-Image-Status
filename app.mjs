import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {Discord} from './rpc.mjs';
import {settings,presence} from './settings.mjs';
const directory=path.dirname(fileURLToPath(import.meta.url));
export function createApp({port=32146,configPath=path.join(directory,'config.json'),discord=new Discord()}={}){
 let config={clientId:'',title:'お気に入りの画像',description:'',image:'',type:2,enabled:false};
 try{config=settings(JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,'')));}catch{}
 let applied=false,sent='',busy=false,revision=0;
 const origin=`http://127.0.0.1:${port}`;
 discord.on('ready',()=>{applied=false;sent='';});
 async function sync(){
  if(busy)return;busy=true;
  try{
   if(!config.clientId)return;
   await discord.connect(config.clientId);
   const value=presence(config),signature=JSON.stringify(value),version=revision;
   if(discord.ready&&(!applied||signature!==sent)){
    const ok=await discord.set(value);if(version===revision){applied=ok;if(ok)sent=signature;}
   }
  }finally{busy=false;}
 }
 const server=http.createServer(async(req,res)=>{
  const json=(code,v)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(v));};
  if(req.headers.host!==`127.0.0.1:${port}`)return json(403,{error:'Invalid host'});
  const publicFiles={'/':['panel.html','text/html; charset=utf-8'],'/panel.js':['panel.js','text/javascript; charset=utf-8']};
  if(req.method==='GET'&&publicFiles[req.url]){
   const [file,type]=publicFiles[req.url];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' https: blob:; frame-ancestors 'none'"});return res.end(fs.readFileSync(path.join(directory,file)));
  }
  if(req.headers['x-local-panel']!=='1'||(req.headers.origin&&req.headers.origin!==origin))return json(403,{error:'Invalid origin'});
  if(req.method==='GET'&&req.url==='/api/status')return json(200,{config,status:discord.status,connected:discord.ready,applied});
  if(req.method!=='POST'||req.url!=='/api/config')return json(404,{});
  if(req.headers.origin!==origin)return json(403,{});
  let size=0,chunks=[];
  try{
   for await(const chunk of req){size+=chunk.length;if(size>20000){json(413,{error:'設定が大きすぎます'});req.destroy();return;}chunks.push(chunk);}
   const next=settings(JSON.parse(Buffer.concat(chunks).toString()));
   // Keep one application identity per running process; restarting avoids races with an old handshake.
   if(config.clientId&&config.clientId!==next.clientId)return json(409,{error:'Application IDを変えるには、プログラムを終了しconfig.jsonを削除して再起動してください'});
   fs.writeFileSync(configPath,JSON.stringify(next,null,2));config=next;revision++;applied=false;
   json(200,{ok:true});void sync();
  }catch(e){json(400,{error:e.message});}
 });
 const timer=setInterval(()=>void sync(),2500);timer.unref();
 async function stop(){clearInterval(timer);await discord.set(null);discord.close();await new Promise(r=>server.close(r));}
 return {server,sync,stop,origin};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=createApp({port:Number(process.env.IMAGE_PORT||32146)});
 app.server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`起動中の設定画面を開いてください: ${app.origin}`:e.message);process.exit(1);});
 app.server.listen(Number(process.env.IMAGE_PORT||32146),'127.0.0.1',()=>{
  console.log(`Discord Image Status\n設定画面: ${app.origin}\n終了: Ctrl+C`);void app.sync();
  if(process.env.IMAGE_OPEN_PANEL==='1'&&process.platform==='win32'){const p=spawn('cmd.exe',['/c','start','',app.origin],{windowsHide:true,stdio:'ignore'});p.on('error',()=>{});p.unref();}
 });
 let stopping=false;const shutdown=async()=>{if(stopping)return;stopping=true;await app.stop();process.exit(0);};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}
