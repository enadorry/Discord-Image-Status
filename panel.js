const el=id=>document.getElementById(id);let initialized=false,previewTimer;
function preview(){
 const sale=el('salesUrl').value.trim(),link=el('salePreview');let valid=false;try{const u=new URL(sale);valid=u.protocol==='https:'&&!u.username&&!u.password;}catch{}link.hidden=!valid;if(valid)link.href=sale;else link.removeAttribute('href');link.textContent=el('buttonLabel').value||'BOOTHで購入';
 el('titlePreview').textContent=el('title').value||'お気に入りの画像';el('descriptionPreview').textContent=el('description').value;el('typePreview').textContent=el('type').selectedOptions[0].textContent;
 const url=el('image').value.trim(),picture=el('picture');el('imageError').textContent='';
 if(!/^https:\/\//i.test(url)){picture.hidden=true;picture.removeAttribute('src');el('imageError').textContent=url?'アセット名の画像はDiscord上で確認できます。':'';return;}
 try{const u=new URL(url);if(u.username||u.password)throw Error();}catch{picture.hidden=true;return;}
 if(picture.getAttribute('src')!==url){picture.hidden=false;picture.src=url;}
}
el('picture').onerror=()=>{el('picture').hidden=true;el('imageError').textContent='画像を読み込めません。画像そのものの公開URLか確認してください。';};
async function refresh(){try{const s=await(await fetch('/api/status',{headers:{'X-Local-Panel':'1'}})).json();el('connection').textContent=s.status;el('connections').replaceChildren(...(s.connections||[]).map(c=>{const li=document.createElement('li');li.textContent=`接続先 ${c.slot+1}：${c.status}`;return li;}));el('delivery').textContent=s.applied?(s.config.enabled?'Discordが更新を受け付けました':'表示を停止しました'):(s.config.enabled?'Discordへの反映を待っています':'表示を停止中');if(!initialized){for(const id of ['clientId','title','description','image','type','salesUrl','buttonLabel'])el(id).value=s.config[id]??(id==='buttonLabel'?'BOOTHで購入':'');initialized=true;preview();}}catch{el('connection').textContent='接続が切れました。START.cmdで起動してください。';}}
async function save(enabled){try{const data={enabled};for(const id of ['clientId','title','description','image','type','salesUrl','buttonLabel'])data[id]=el(id).value;const response=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Panel':'1'},body:JSON.stringify(data)});const value=await response.json();el('message').textContent=response.ok?(enabled?'保存しました。Discordへの反映を待っています。':'停止設定を保存しました。'):value.error;refresh();}catch{el('message').textContent='保存できませんでした。プログラムの起動を確認してください。';}}
el('settings').onsubmit=e=>{e.preventDefault();save(true);};el('hide').onclick=()=>save(false);
for(const id of ['title','description','image','type','salesUrl','buttonLabel'])el(id).addEventListener('input',()=>{clearTimeout(previewTimer);previewTimer=setTimeout(preview,350);});
el('portal').onclick=()=>{const id=el('clientId').value.trim();if(!/^\d{17,22}$/.test(id)){el('message').textContent='先にApplication IDを入力してください';return;}window.open(`https://discord.com/developers/applications/${id}/rich-presence/assets`,'_blank','noopener,noreferrer');};refresh();setInterval(refresh,2500);
