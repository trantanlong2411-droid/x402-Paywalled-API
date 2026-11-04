import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.X402_SERVER_URL||'https://x402-paywalled-api.trantanlong2411.workers.dev').replace(/\/$/,'');
async function read(path,headers={}){
 const res=await fetch(base+path,{headers,signal:AbortSignal.timeout(20000)});
 let value;
 try{value=await res.json()}catch{value=null}
 return {res,value};
}
let h;
for(let i=0;i<22;i++){
 try{
  const obj=await read('/health');h=obj;
  if(obj.res.status===200&&obj.value?.version==='pharos-x402-atlantic-2026-11-04-v1')break;
 }catch(e){console.log('WORKER_WAIT',i,String(e.message||e).slice(0,90))}
 await new Promise(r=>setTimeout(r,4500));
}
assert.equal(h?.res?.status,200,'Production Worker URL not published');
assert.equal(h.value.version,'pharos-x402-atlantic-2026-11-04-v1','Wrong Worker version');
assert.equal(h.value.chainId,688689);
assert.equal(h.value.network,'eip155:688689');
assert.equal(h.value.config.durableReplayProtection,true);
if(!h.value.config.configured){
 console.log('LIVE_SECRET_CONFIGURATION_REQUIRED',JSON.stringify({
  codeDeployed:true,network:688689,
  nextStep:'Add FACILITATOR_PRIVATE_KEY as Cloudflare Worker encrypted secret and fund it with PHRS; then rerun this workflow',
  livePaymentVerified:false}));
 throw Error('Worker deployed but self-hosted facilitator is not configured. This is NOT a 402 payment success.');
}
const sampleAddress='0x1111111111111111111111111111111111111111';
const balance=await read('/api/balance?address='+sampleAddress);
assert.equal(balance.res.status,200,'Deployed Worker must expose read-only USDC balance');
assert.equal(balance.value.ok,true);
assert.equal(balance.value.buyer.toLowerCase(),sampleAddress.toLowerCase());
assert.equal(balance.value.asset.toLowerCase(),h.value.config.asset.toLowerCase());
assert.ok(Number.isFinite(Number(balance.value.balanceUSDC)) && Number(balance.value.balanceUSDC)>=0,'USDC balance must be numeric');
assert.equal(balance.value.network,'eip155:688689');
console.log('LIVE_BUYER_BALANCE_ENDPOINT_VERIFIED',JSON.stringify({
  network:balance.value.network,contract:balance.value.asset,
  sampleTokenBalanceUSDC:balance.value.balanceUSDC,block:balance.value.block
}));
const supported=await read('/supported');
assert.equal(supported.res.status,200);
assert.ok(supported.value.kinds.some(x=>x.network==='eip155:688689'&&x.scheme==='exact'));
const prices=[];
for(const path of ['/api/insights','/api/report']){
 const x=await read(path);
 assert.equal(x.res.status,402,'Expected HTTP 402 for unauthenticated paid route');
 const header=x.res.headers.get('PAYMENT-REQUIRED');
 assert.ok(header);
 const decoded=JSON.parse(Buffer.from(header,'base64').toString('utf8'));
 assert.equal(decoded.x402Version,2);
 assert.equal(decoded.accepts[0].scheme,'exact');
 assert.equal(decoded.accepts[0].network,'eip155:688689');
 assert.equal(decoded.accepts[0].asset.toLowerCase(),h.value.config.asset.toLowerCase());
 prices.push(decoded.accepts[0].amount);
 const bad=await read(path,{'PAYMENT-SIGNATURE':Buffer.from(JSON.stringify({
  x402Version:2,resource:decoded.resource,accepted:decoded.accepts[0],
  payload:{signature:'0x'+'00'.repeat(65),authorization:{}}
 })).toString('base64')});
 assert.equal(bad.res.status,402,'Bad payment must be rejected with another 402');
}
assert.deepEqual(prices,['1000','3000']);
const json={
 schema:'pharos-x402-deployed-readiness-v1',checkedAtUtc:new Date().toISOString(),
 site:base,version:h.value.version,
 chainId:688689,freeHealthStatus:200,facilitatorSupported:true,
 firstPaid:{path:'/api/insights',statusWithoutPayment:402,amount:'1000'},
 secondPaid:{path:'/api/report',statusWithoutPayment:402,amount:'3000'},
 badSignedPayloadBlocked:true,
 actualSignedPaymentVerified:false,
 note:'This tests public 402 gates and facilitator readiness, NOT signed testnet settlement. A separate funded client must produce a real PAYMENT-RESPONSE and explorer transaction.'
};
await mkdir('proof',{recursive:true});
await writeFile('proof/deployed-readiness.json',JSON.stringify(json,null,2)+'\n');
console.log('X402_DEPLOYED_402_GATE_SUCCESS',JSON.stringify(json));
