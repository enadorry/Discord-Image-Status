import net from 'node:net';
import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
export function frame(op,value){const d=Buffer.from(JSON.stringify(value)),h=Buffer.alloc(8);h.writeUInt32LE(op);h.writeUInt32LE(d.length,4);return Buffer.concat([h,d]);}
export class Decoder{
 buffer=Buffer.alloc(0);
 push(chunk){this.buffer=Buffer.concat([this.buffer,chunk]);const out=[];while(this.buffer.length>=8){const size=this.buffer.readUInt32LE(4);if(size>1048576)throw Error('IPC frame too large');if(this.buffer.length<8+size)break;out.push([this.buffer.readUInt32LE(0),JSON.parse(this.buffer.subarray(8,8+size).toString())]);this.buffer=this.buffer.subarray(8+size);}return out;}
}
export class Discord extends EventEmitter{
 socket=null;ready=false;connecting=false;status='Application IDを設定してください';pending=new Map();
 constructor(paths=Array.from({length:10},(_,i)=>String.raw`\\?\pipe\discord-ipc-${i}`)){super();this.paths=paths;}
 async connect(id){
  if(this.socket||this.connecting||!id)return;this.connecting=true;
  try{for(const path of this.paths){
   const s=net.createConnection(path);
   const ok=await new Promise(resolve=>{const timer=setTimeout(()=>resolve(false),500);s.once('connect',()=>{clearTimeout(timer);resolve(true);});s.once('error',()=>{clearTimeout(timer);resolve(false);});});
   if(!ok){s.destroy();continue;}this.socket=s;const decoder=new Decoder();this.status='Discordに接続中';const timer=setTimeout(()=>s.destroy(),5000);
   s.on('data',chunk=>{try{for(const[op,p]of decoder.push(chunk)){
    if(op===3)s.write(frame(4,p));if(op===2){this.status='Discordが接続を終了しました';s.destroy();}
    if(p.evt==='READY'){clearTimeout(timer);this.ready=true;this.status='Discord接続済み';this.emit('ready');}
    if(p.evt==='ERROR')this.status=`Discordエラー: ${p.data?.message||p.data?.code}`;
    if(p.nonce&&this.pending.has(p.nonce)){const cb=this.pending.get(p.nonce);this.pending.delete(p.nonce);cb(p);}
   }}catch{this.status='Discord応答の解析に失敗';s.destroy();}});
   s.on('error',()=>{});s.once('close',()=>{clearTimeout(timer);if(this.socket===s){this.socket=null;this.ready=false;if(!this.status.includes('エラー'))this.status='Discord未接続（自動再接続）';for(const cb of this.pending.values())cb({evt:'ERROR'});this.pending.clear();}});
   s.write(frame(0,{v:1,client_id:id}));return;
  }this.status='Discordデスクトップ版を起動してください';}finally{this.connecting=false;}
 }
 async set(value){if(!this.ready)return false;const nonce=randomUUID();return new Promise(resolve=>{const timer=setTimeout(()=>{this.pending.delete(nonce);resolve(false);},5000);this.pending.set(nonce,p=>{clearTimeout(timer);const ok=p.evt!=='ERROR';if(ok)this.status='Discord接続済み';resolve(ok);});this.socket.write(frame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:value},nonce}));});}
 close(){this.socket?.destroy();this.ready=false;}
}


