import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {DiscordGroup,Decoder,frame} from '../rpc.mjs';
const pipe=n=>process.platform==='win32'?String.raw`\\?\pipe\image-multi-${process.pid}-${n}`:path.join(os.tmpdir(),`image-multi-${process.pid}-${n}.sock`);
async function waitFor(predicate){const end=Date.now()+3000;while(!predicate()){if(Date.now()>end)throw Error('condition timeout');await new Promise(r=>setTimeout(r,5));}}
async function mock(name){
 const received=[],sockets=new Set();let reject=false;
 const server=net.createServer(s=>{sockets.add(s);s.on('error',()=>{});s.on('close',()=>sockets.delete(s));const d=new Decoder();s.on('data',chunk=>{for(const [op,p]of d.push(chunk)){
  if(op===0)s.write(frame(1,{evt:'READY'}));
  if(p.cmd==='SET_ACTIVITY'){received.push(p.args.activity);s.write(frame(1,reject?{nonce:p.nonce,evt:'ERROR',data:{message:'Rejected'}}:{nonce:p.nonce,cmd:p.cmd}));}
 }});});
 server.listen(name);await once(server,'listening');
 return {received,set reject(v){reject=v;},async stop(){for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}};
}
const a={type:2,status_display_type:2,details:'両方に表示',assets:{large_image:'https://example.com/image.gif'}};
test('broadcast to two clients, deduplicate unchanged updates, clear both',async()=>{
 const first=await mock(pipe(1)),second=await mock(pipe(2)),group=new DiscordGroup([pipe(1),pipe(2)]);
 try{await group.connect('123456789012345678');await waitFor(()=>group.connections.length===2);assert.equal(await group.set(a),true);assert.deepEqual(first.received,[a]);assert.deepEqual(second.received,[a]);assert.match(group.status,/2個/);
 await group.set(a);assert.equal(first.received.length,1);assert.equal(second.received.length,1);
 const b={...a,details:'変更後'};assert.equal(await group.set(b),true);assert.deepEqual(first.received.at(-1),b);assert.deepEqual(second.received.at(-1),b);
 await group.set(null);assert.equal(first.received.at(-1),null);assert.equal(second.received.at(-1),null);
 }finally{group.close();await Promise.all([first.stop(),second.stop()]);}
});
test('late-started client and restarted client receive activity without resending to healthy client',async()=>{
 const first=await mock(pipe(3));let second;const group=new DiscordGroup([pipe(3),pipe(4)]);
 try{
  await group.connect('123456789012345678');await waitFor(()=>group.connections.length===1);await group.set(a);
  second=await mock(pipe(4));await group.connect('123456789012345678');await waitFor(()=>group.connections.length===2);await group.set(a);assert.deepEqual(second.received,[a]);assert.equal(first.received.length,1);
  const closed=once(group.clients[1].client.socket,'close');await second.stop();second=null;await closed;assert.equal(group.connections.length,1);
  second=await mock(pipe(4));await group.connect('123456789012345678');await waitFor(()=>group.connections.length===2);await group.set(a);assert.deepEqual(second.received,[a]);assert.equal(first.received.length,1);
 }finally{group.close();await first.stop();if(second)await second.stop();}
});
test('one client rejecting does not suppress the other or flood it with retries',async()=>{
 const first=await mock(pipe(5)),second=await mock(pipe(6)),group=new DiscordGroup([pipe(5),pipe(6)]);
 try{second.reject=true;await group.connect('123456789012345678');await waitFor(()=>group.connections.length===2);assert.equal(await group.set(a),false);assert.match(group.status,/Rejected/);assert.deepEqual(first.received,[a]);await group.set(a);assert.equal(first.received.length,1);second.reject=false;assert.equal(await group.set(a),true);assert.equal(first.received.length,1);}finally{group.close();await Promise.all([first.stop(),second.stop()]);}
});
