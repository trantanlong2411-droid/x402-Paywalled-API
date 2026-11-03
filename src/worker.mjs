import {DurableObject} from 'cloudflare:workers';
import {config,publicConfig,ROUTES,NETWORK,EXPLORER} from './config.mjs';
import {json,required,challenge,b64,unb64,paymentResponse} from './protocol.mjs';
import {verifyPayment,verifyForRoute,settlePayment,parseSignedPayment} from './facilitator.mjs';
import {PAGE} from './page.mjs';

export const VERSION='pharos-x402-atlantic-2026-11-04-v1';
const MAX_BODY=25000;
const receiptHeader=transaction=>b64(transaction);

export class PaymentLedger extends DurableObject{
 constructor(ctx,env){super(ctx,env);
  this.sql=ctx.storage.sql;
  this.sql.exec('CREATE TABLE IF NOT EXISTS authorizations (id TEXT PRIMARY KEY,status TEXT NOT NULL,transaction_hash TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
 }
 async fetch(request){
  if(request.method!=='POST')return json({error:'Only POST'},405);
  const path=new URL(request.url).pathname;
  let input;try{input=await request.json()}catch{return json({error:'Malformed ledger message'},400)}
  if(!/^0x[0-9a-f]{64}$/i.test(input?.id||''))return json({error:'Invalid payment identifier'},400);
  const now=new Date().toISOString();
  if(path==='/claim'){
   // SQLite uniqueness serializes simultaneous claims for the same EIP-3009 authorization.
   const existing=this.sql.exec('SELECT status,transaction_hash FROM authorizations WHERE id=?',input.id).toArray()[0];
   if(existing)return json({claimed:false,status:existing.status,transaction:existing.transaction_hash||null});
   this.sql.exec('INSERT OR IGNORE INTO authorizations(id,status,transaction_hash,created_at,updated_at) VALUES(?,?,?,?,?)',
    input.id,'reserved',null,now,now);
   const row=this.sql.exec('SELECT status,transaction_hash FROM authorizations WHERE id=?',input.id).toArray()[0];
   return json({claimed:row.status==='reserved'&&!row.transaction_hash,transaction:row.transaction_hash||null});
  }
  if(path==='/update'){
   if(!['broadcasting','settled','failed'].includes(input.status))return json({error:'Bad ledger state'},400);
   if(input.transaction&&!/^0x[0-9a-f]{64}$/i.test(input.transaction))return json({error:'Bad transaction hash'},400);
   const row=this.sql.exec('SELECT status,transaction_hash FROM authorizations WHERE id=?',input.id).toArray()[0];
   if(!row)return json({error:'No payment reservation'},404);
   if(row.transaction_hash&&input.transaction&&row.transaction_hash.toLowerCase()!==input.transaction.toLowerCase())
    return json({error:'Cannot replace settlement transaction'},409);
   if(row.status==='settled'&&input.status!=='settled')return json({error:'Already settled'},409);
   this.sql.exec('UPDATE authorizations SET status=?,transaction_hash=?,updated_at=? WHERE id=?',
    input.status,row.transaction_hash||input.transaction||null,now,input.id);
   return json({updated:true,status:input.status});
  }
  return json({error:'Not found'},404);
 }
}
function serviceData(path){
 if(path==='/api/insights')return {
  service:'Pharos Atlantic Insights',network:NETWORK,
  metrics:{riskIndex:23,networkActivity:'Active',referenceBlock:'illustrative'},
  note:'Illustrative insights data unlocked after verified testnet payment.',
  timestamp:new Date().toISOString()
 };
 return {
  service:'Pharos Atlantic Analytics Report',network:NETWORK,
  reports:[{metric:'x402 protocol',value:'exact EIP-3009 settlement'},
   {metric:'facilitator',value:'Self-hosted verification and testnet settlement'},
   {metric:'network',value:'Pharos Atlantic Testnet 688689'}],
  note:'Fixed demonstration report, no real-time trading signal.',
  timestamp:new Date().toISOString()
 };
}
async function body(request){
 const text=await request.text();
 if(text.length>MAX_BODY)throw Error('Request body too large');
 const obj=JSON.parse(text);
 if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('JSON object required');
 return obj;
}
async function facilitator(request,c,env,path){
 if(path==='/supported'){
  return json({kinds:c.ready?[{x402Version:2,scheme:'exact',network:NETWORK}]:[],
   extensions:[],signers:c.ready?{'eip155:*':[c.relayer]}:{},
   configured:c.ready,asset:c.asset,chainId:688689});
 }
 if(request.method!=='POST')return json({error:'POST required'},405);
 let value;try{value=await body(request)}
 catch{return json({error:'Malformed x402 facilitator request'},400)}
 if(!c.ready)return json({success:false,isValid:false,errorReason:'Facilitator not configured; set secrets and ledger binding'},503);
 const paymentPayload=value.paymentPayload,requirements=value.paymentRequirements;
 if(!paymentPayload||!requirements)return json({error:'paymentPayload and paymentRequirements required'},400);
 if(path==='/verify'){
  const verification=await verifyPayment(paymentPayload,requirements,c);
  const {paymentId,calldata,block,...publicResult}=verification;
  return json(publicResult);
 }
 const id=env.PAYMENT_LEDGER.idFromName('atlantic-x402-settlement');
 const ledger=env.PAYMENT_LEDGER.get(id);
 const result=await settlePayment(paymentPayload,requirements,c,ledger);
 return json(result);
}
export default {
 async fetch(request,env={}){
  const url=new URL(request.url);
  const path=url.pathname;
  const c=config(env);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
    'access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS',
    'access-control-allow-headers':'Content-Type, PAYMENT-SIGNATURE, X-PAYMENT',
    'access-control-max-age':'86400'
  }});
  if(request.method==='GET'&&(path==='/'||path==='/index.html'))
   return new Response(PAGE,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store',
    'content-security-policy':"default-src 'none'; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"}});
  if(request.method==='GET'&&path==='/health'){
   return json({ok:true,version:VERSION,network:NETWORK,chainId:688689,
    status:c.ready?'ready':'configuration_required',
    facilitator:'self-hosted',config:publicConfig(c),
    note:'A healthy endpoint does not prove an on-chain settlement'});
  }
  if(path==='/supported'||path==='/verify'||path==='/settle'||
   path==='/facilitator/supported'||path==='/facilitator/verify'||path==='/facilitator/settle'){
   return facilitator(request,c,env,path.split('/').pop()==='supported'?'/supported':
    path.split('/').pop()==='verify'?'/verify':'/settle');
  }
  if(request.method==='GET'&&path==='/api/config')
   return json({version:VERSION,config:publicConfig(c),ready:c.ready,
    routes:Object.entries(ROUTES).map(([pathname,r])=>({path:pathname,
     price:r.price+' test USDC',amount:r.amount,description:r.description})),
    explorerBase:EXPLORER});
  if(request.method!=='GET'||!ROUTES[path])return json({error:'Not found'},404);
  if(!c.ready)return json({error:'Configuration required: set FACILITATOR_PRIVATE_KEY (testnet) and PAY_TO_ADDRESS using Cloudflare secrets',
   ready:false,network:NETWORK},503);
  const urlString=url.origin+path;
  const encoded=request.headers.get('PAYMENT-SIGNATURE')||request.headers.get('X-PAYMENT');
  if(!encoded)return challenge(urlString,path,c);
  let payload;
  try{payload=unb64(encoded)}catch{return challenge(urlString,path,c,'Invalid PAYMENT-SIGNATURE header');}
  const offered=required(urlString,path,c);
  // A signed header must accept this specific paid route. No underpayment or cross-route reuse.
  let parsed;
  try{
   parsed=parseSignedPayment(payload,offered.accepts[0],c);
   if(payload.resource?.url!==urlString)throw Error('Signed payment resource mismatch');
  }catch(e){return challenge(urlString,path,c,String(e.message||e));}
  const ledger=env.PAYMENT_LEDGER.get(env.PAYMENT_LEDGER.idFromName('atlantic-x402-settlement'));
  const settlement=await settlePayment(payload,offered.accepts[0],c,ledger);
  if(!settlement.success)return challenge(urlString,path,c,settlement.errorReason||'Payment was not settled');
  const receipt=paymentResponse(settlement.transaction,settlement.payer);
  return json({ok:true,data:serviceData(path),payment:receipt},200,{
   'PAYMENT-RESPONSE':receiptHeader(receipt)
  });
 }
};
