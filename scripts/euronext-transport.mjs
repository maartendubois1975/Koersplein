// Euronext public AJAX transport decoder. No account credentials or authenticated access.
import {createHash,createDecipheriv} from 'node:crypto';
export function decodeEuronextBody(text){
 if(!/^\s*[\[{"]/.test(text))return text;
 let payload;try{payload=JSON.parse(text)}catch{throw Error('INVALID_JSON_RESPONSE')}
 if(payload&&typeof payload==='object'&&payload.ct&&payload.iv&&payload.s){
  const passphrase=Buffer.from('24ayqVo7yJma');
  const salt=Buffer.from(payload.s,'hex');
  if(salt.length!==8)throw Error('INVALID_TRANSPORT_SALT');
  let prev=Buffer.alloc(0),keyMaterial=Buffer.alloc(0);
  while(keyMaterial.length<48){prev=createHash('md5').update(Buffer.concat([prev,passphrase,salt])).digest();keyMaterial=Buffer.concat([keyMaterial,prev])}
  const cipher=createDecipheriv('aes-256-cbc',keyMaterial.subarray(0,32),Buffer.from(payload.iv,'hex'));
  try{payload=JSON.parse(Buffer.concat([cipher.update(Buffer.from(payload.ct,'base64')),cipher.final()]).toString('utf8'))}
  catch{throw Error('TRANSPORT_DECODE_FAILED')}
 }
 const html=[];
 const walk=(x,depth=0)=>{if(depth>12)return;if(typeof x==='string'&&x.includes('<tr'))html.push(x);else if(x&&typeof x==='object')Object.values(x).forEach(v=>walk(v,depth+1))};
 walk(payload);
 if(!html.length)throw Error('NO_HTML_TABLE_IN_RESPONSE');
 return html.join('\n');
}
