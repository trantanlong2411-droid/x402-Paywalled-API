import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {config} from '../src/config.mjs';
import {ABI,rpc} from '../src/facilitator.mjs';
const c=config({TEST_USDC_ADDRESS:process.env.TEST_USDC_ADDRESS,
 ATLANTIC_RPC_URL:process.env.ATLANTIC_RPC_URL});
const chain=await rpc(c,'eth_chainId',[]);
assert.equal(BigInt(chain),688689n,'Not Atlantic Testnet');
const height=await rpc(c,'eth_blockNumber',[]);
const code=await rpc(c,'eth_getCode',[c.asset,'latest']);
assert.ok(typeof code==='string'&&code.length>4,'Test USDC contract missing');
async function call(method,args=[]){
 const res=await rpc(c,'eth_call',[{to:c.asset,data:ABI.encodeFunctionData(method,args)},'latest']);
 return ABI.decodeFunctionResult(method,res)[0];
}
const [symbol,name,decimals]=await Promise.all([call('symbol'),call('name'),call('decimals')]);
assert.equal(String(symbol).toUpperCase(),'USDC');
assert.equal(Number(decimals),6);
let authorizationState=false;
try{
 const state=await call('authorizationState',['0x1111111111111111111111111111111111111111',
  '0x'+'11'.repeat(32)]);
 authorizationState=typeof state==='boolean';
}catch(e){console.log('AUTHORIZATION_STATE_UNAVAILABLE',String(e.message||e).slice(0,140))}
assert.equal(authorizationState,true,'Token does not expose EIP-3009 authorizationState');
let version=null;
try{version=String(await call('version'))}catch{}
const result={
 schema:'pharos-x402-atlantic-token-audit-v1',
 observedAtUtc:new Date().toISOString(),chainId:Number(BigInt(chain)),
 block:BigInt(height).toString(),testUsdcContract:c.asset,
 token:{symbol:String(symbol),name:String(name),decimals:Number(decimals),version},
 eip3009AuthorizationStateSupported:authorizationState,
 note:'Read-only network and contract verification. Not a signed payment or settlement.'
};
await mkdir('proof',{recursive:true});
await writeFile('proof/atlantic-token-audit.json',JSON.stringify(result,null,2)+'\n');
console.log('PHAROS_ATLANTIC_X402_TEST_USDC_VERIFIED',JSON.stringify(result));
