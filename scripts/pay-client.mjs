import assert from 'node:assert/strict';
import {Wallet,randomBytes,hexlify} from 'ethers';
import {mkdir,writeFile} from 'node:fs/promises';
import {NETWORK,CHAIN_ID} from '../src/config.mjs';
import {TYPES} from '../src/facilitator.mjs';

const base=(process.env.X402_SERVER_URL||
 'https://x402-paywalled-api.trantanlong2411.workers.dev').replace(/\/$/,'');
const path=process.argv[2]||'/api/insights';
if(!['/api/insights','/api/report'].includes(path))throw Error('Use /api/insights or /api/report');
const key=process.env.CLIENT_PRIVATE_KEY;
if(!key||!/^0x[0-9a-fA-F]{64}$/.test(key))
 throw Error('Set CLIENT_PRIVATE_KEY as an environment variable on your own machine (dedicated TESTNET wallet only). Never commit or paste it.');
const signer=new Wallet(key);
const original=await fetch(base+path,{signal:AbortSignal.timeout(18000)});
const initial=await original.text();
if(original.status!==402){
 throw Error('Expected HTTP 402. Received '+original.status+' '+initial.slice(0,300));
}
const encoded=original.headers.get('PAYMENT-REQUIRED');
if(!encoded)throw Error('Missing x402 PAYMENT-REQUIRED header');
const challenge=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));
const offered=challenge.accepts?.[0];
assert.equal(challenge.x402Version,2);
assert.equal(offered.network,NETWORK);
assert.equal(offered.scheme,'exact');
assert.ok(/^0x[0-9a-f]{40}$/i.test(offered.asset));
assert.ok(/^0x[0-9a-f]{40}$/i.test(offered.payTo));
assert.ok(['1000','3000'].includes(offered.amount));
const now=Math.floor(Date.now()/1000);
const authorization={from:signer.address,to:offered.payTo,value:String(offered.amount),
 validAfter:String(now-30),validBefore:String(now+240),nonce:hexlify(randomBytes(32))};
const domain={name:offered.extra.name,version:offered.extra.version,
 chainId:CHAIN_ID,verifyingContract:offered.asset};
const signature=await signer.signTypedData(domain,TYPES,authorization);
const payload={x402Version:2,resource:challenge.resource,accepted:offered,
 payload:{signature,authorization}};
console.log('X402_SIGNED_EIP712_TESTNET',{route:path,payer:signer.address,
 amountAtomic:offered.amount,network:offered.network});
const paid=await fetch(base+path,{headers:{
 'PAYMENT-SIGNATURE':Buffer.from(JSON.stringify(payload)).toString('base64')},
 signal:AbortSignal.timeout(100000)});
const response=await paid.json();
if(paid.status!==200){
 console.log('PAYMENT_REJECTED_OR_PENDING',JSON.stringify({status:paid.status,response},null,2));
 process.exitCode=1;
}else{
 const paymentHeader=paid.headers.get('PAYMENT-RESPONSE');
 if(!paymentHeader)throw Error('Missing PAYMENT-RESPONSE');
 const receipt=JSON.parse(Buffer.from(paymentHeader,'base64').toString('utf8'));
 assert.equal(receipt.success,true);
 assert.equal(receipt.network,NETWORK);
 assert.ok(/^0x[0-9a-f]{64}$/i.test(receipt.transaction));
 assert.equal(response.payment.transaction.toLowerCase(),receipt.transaction.toLowerCase());
 const evidence={schema:'pharos-x402-real-payment-proof-v1',utc:new Date().toISOString(),
  network:NETWORK,path,initialStatus:402,finalStatus:200,
  payer:signer.address,payTo:offered.payTo,
  token:offered.asset,amount:offered.amount,
  paymentResponse:receipt,explorer:'https://atlantic.pharosscan.xyz/tx/'+receipt.transaction,
  privateKeyLogged:false,source:'Real testnet signed authorization and facilitator receipt'};
 await mkdir('proof',{recursive:true});
 await writeFile('proof/client-payment-result.json',JSON.stringify(evidence,null,2)+'\n');
 console.log('X402_REAL_402_SIGN_SETTLE_200_SUCCESS',JSON.stringify(evidence));
}
