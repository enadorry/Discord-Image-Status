import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,once} from 'node:events';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {settings,presence} from '../settings.mjs';
import {frame,Decoder,Discord} from '../rpc.mjs';
import {createApp} from '../app.mjs';
const input={clientId:'123456789012345678',title:'好きな絵',description:'お気に入り',image:'https://example.com/picture.png?version=1',type:2,enabled:true};
test('arbitrary public image URL and uploaded asset name',()=>{assert.equal(settings(input).image,input.image);assert.equal(settings({...input,image:'my_image'}).image,'my_image');for(const image of ['file:///C:/a.png','http://example.com/a.png','https://user:pass@example.com/a.png','data:image/png,abc','C:\\a.png'])assert.throws(()=>settings({...input,image}));});
test('listening card with image, title, description, hide and artwork change',()=>{const p=presence(settings(input));assert.equal(p.assets.large_image,input.image);assert.equal(p.details,input.title);assert.equal(p.status_display_type,2);assert.equal(p.state,input.description);assert.equal(p.type,2);assert.equal(presence(settings({...input,enabled:false})),null);assert.equal(presence(settings({...input,image:'other_image',description:''})).assets.large_image,'other_image');assert.equal(presence(settings({...input,description:''})).state,undefined);});
test('settings validate application ID and activity type',()=>{assert.throws(()=>settings({...input,clientId:'bad'}));assert.throws(()=>settings({...input,type:4}));assert.equal(settings({...input,title:'a'.repeat(200)}).title.length,128);});
test('real IPC handshake and exact image payload, clear',async()=>{
 const pipe=process.platform==='win32'?String.raw`\\?\pipe\image-status-test-${process.pid}`:path.join(os.tmpdir(),`image-status-${process.pid}.sock`);
 let socket;const received=[];
 const server=net.createServer(s=>{socket=s;const d=new Decoder();s.on('data',chunk=>{for(const[op,p]of d.push(chunk)){if(op===0)s.write(frame(1,{evt:'READY'}));if(p.cmd==='SET_ACTIVITY'){received.push(p.args.activity);s.write(frame(1,{nonce:p.nonce,cmd:'SET_ACTIVITY'}));}}});});
 server.listen(pipe);await once(server,'listening');const rpc=new Discord([pipe]);
 try{const ready=once(rpc,'ready');await rpc.connect(input.clientId);await ready;const p=presence(settings(input));assert.equal(await rpc.set(p),true);assert.deepEqual(received[0],p);assert.equal(await rpc.set(null),true);assert.equal(received[1],null);}finally{rpc.close();socket?.destroy();await new Promise(r=>server.close(r));}
});
test('local panel: save, persist, show, stop, reject cross-origin and reconnect',async()=>{
 class MockDiscord extends EventEmitter{ready=false;status='未接続';values=[];async connect(){if(!this.ready){this.ready=true;this.status='接続済み';this.emit('ready');}}async set(v){this.values.push(v);return true;}close(){this.ready=false;}}
 const probe=net.createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'image-status-')),configPath=path.join(dir,'config.json'),rpc=new MockDiscord(),app=createApp({port,configPath,discord:rpc});
 app.server.listen(port,'127.0.0.1');await once(app.server,'listening');const headers={'X-Local-Panel':'1','Content-Type':'application/json',Origin:app.origin};
 try{
  assert.equal((await fetch(app.origin)).status,200);assert.equal((await fetch(app.origin+'/api/status')).status,403);
  assert.equal((await fetch(app.origin+'/api/config',{method:'POST',headers:{...headers,Origin:'https://evil.test'},body:JSON.stringify(input)})).status,403);
  assert.equal((await fetch(app.origin+'/api/config',{method:'POST',headers,body:JSON.stringify({...input,clientId:'bad'})})).status,400);
  assert.equal((await fetch(app.origin+'/api/config',{method:'POST',headers,body:JSON.stringify(input)})).status,200);await app.sync();
  const state=await(await fetch(app.origin+'/api/status',{headers})).json();assert.equal(state.applied,true);assert.equal(state.config.image,input.image);assert.equal(rpc.values.at(-1).assets.large_image,input.image);assert.equal(JSON.parse(fs.readFileSync(configPath)).title,input.title);
  assert.equal((await fetch(app.origin+'/api/config',{method:'POST',headers,body:JSON.stringify({...input,enabled:false})})).status,200);await app.sync();assert.equal(rpc.values.at(-1),null);
  rpc.ready=false;await app.sync();assert.equal(rpc.values.at(-1),null);
 }finally{await app.stop();assert.equal(path.dirname(configPath),dir);fs.rmSync(dir,{recursive:true,force:true});}
});

