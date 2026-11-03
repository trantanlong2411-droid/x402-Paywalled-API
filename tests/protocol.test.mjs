import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet} from 'ethers';
import {config,CHAIN_ID,NETWORK,ROUTES} from '../src/config.mjs';
import {required,challenge,unb64} from '../src/protocol.mjs';
import {PAGE} from '../src/page.mjs';
import {Script} from 'node:vm';
function cfg(){
 const key=Wallet.createRandom().privateKey;
 return config({FACILITATOR_PRIVATE_KEY:key,PAY_TO_ADDRESS:Wallet.createRandom().address,
  PAYMENT_LEDGER:{get(){},idFromName(){}}});
}
test('Atlantic chain and exactly two distinct paid routes',()=>{
 const c=cfg();
 assert.equal(CHAIN_ID,688689);assert.equal(NETWORK,'eip155:688689');
 assert.equal(c.ready,true);assert.equal(Object.keys(ROUTES).length,2);
 assert.notEqual(ROUTES['/api/insights'].amount,ROUTES['/api/report'].amount);
 const a=required('https://example.com/api/insights','/api/insights',c);
 assert.equal(a.x402Version,2);assert.equal(a.accepts[0].scheme,'exact');
 assert.equal(a.accepts[0].network,'eip155:688689');
 assert.equal(a.accepts[0].amount,'1000');
 assert.equal(a.accepts[0].extra.assetTransferMethod,'eip3009');
});
test('unpaid endpoint returns real 402 and a parseable PAYMENT-REQUIRED header',async()=>{
 const c=cfg();
 const resp=challenge('https://example.com/api/insights','/api/insights',c);
 assert.equal(resp.status,402);
 const header=resp.headers.get('PAYMENT-REQUIRED');
 assert.ok(header);
 const data=unb64(header);
 assert.equal(data.accepts[0].amount,'1000');
 assert.equal(data.accepts[0].asset.toLowerCase(),c.asset.toLowerCase());
 const body=await resp.json();
 assert.equal(body.x402Version,2);
});
test('no secrets in public config and no readiness without relay key or replay ledger',()=>{
 const a=config({});
 assert.equal(a.ready,false);
 assert.equal(a.relayKey,null);
 assert.equal(config({FACILITATOR_PRIVATE_KEY:Wallet.createRandom().privateKey}).ready,false);
});
test('website has wallet signing client, 2 different paid routes, facilitator and explorer proof',()=>{
 for(const text of ['PAYMENT-REQUIRED','PAYMENT-RESPONSE',
  'Pay & get insights','Pay & get report','Preview 402',
  'eth_signTypedData_v4','eth_requestAccounts','/supported',
  'atlantic.pharosscan.xyz','/health']){
   assert.ok(PAGE.includes(text),'Missing '+text);
 }
 const src=PAGE.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(src);new Script(src[1]);
 assert.doesNotMatch(PAGE,/PRIVATE_KEY\s*=\s*0x[0-9a-f]{64}/i);
});
