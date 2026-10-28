export function settings(input){
 if(!input||typeof input!=='object')throw Error('設定が不正です');
 const clientId=String(input.clientId||'').trim();
 if(!/^\d{17,22}$/.test(clientId))throw Error('Application IDは17〜22桁の数字を入力してください');
 const text=(v,fallback='')=>[...String(v||fallback).replace(/[\x00-\x1f]/g,'').trim()].slice(0,128).join('');
 const title=text(input.title,'お気に入りの画像'),description=text(input.description);
 const image=String(input.image||'').trim();
 if(!image)throw Error('画像URLまたはアップロードした画像のアセット名を入力してください');
 if(!/^[a-z0-9_.-]{1,128}$/.test(image)){
  let u;try{u=new URL(image);}catch{throw Error('画像にはhttps://で始まる直接URL、またはアセット名を入力してください');}
  if(u.protocol!=='https:'||u.username||u.password||image.length>2048)throw Error('画像URLにはhttps://で始まる公開画像のURLを入力してください');
 }
 let salesUrl=String(input.salesUrl||'').trim();
 if(salesUrl){let u;try{u=new URL(salesUrl);}catch{throw Error('販売ページのURLが不正です');}if(u.protocol!=='https:'||u.username||u.password||salesUrl.length>256)throw Error('販売ページには256文字以内のHTTPS URLを入力してください');salesUrl=u.href;if(salesUrl.length>256)throw Error('販売ページのURLが長すぎます');}
 const buttonLabel=[...text(input.buttonLabel,'BOOTHで購入')].slice(0,32).join('')||'BOOTHで購入';
 const type=Number(input.type??2);if(![0,2,3].includes(type))throw Error('表示の種類が不正です');
 return {clientId,title,description,image,type,salesUrl,buttonLabel,enabled:input.enabled===true};
}
export function presence(config){
 if(!config.enabled)return null;
 const title=config.title.length<2?config.title+' ':config.title;
 const result={type:config.type,status_display_type:2,details:title,assets:{large_image:config.image,large_text:title}};
 if(config.description)result.state=config.description.length<2?config.description+' ':config.description;
 if(config.salesUrl){result.buttons=[{label:config.buttonLabel||'BOOTHで購入',url:config.salesUrl}];result.details_url=config.salesUrl;result.assets.large_url=config.salesUrl;}
 return result;
}
