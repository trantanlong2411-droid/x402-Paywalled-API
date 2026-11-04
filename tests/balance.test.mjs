import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import {readBuyerBalance} from '../src/balance.mjs';
import {config} from '../src/config.mjs';
import {PAGE} from '../src/page.mjs';
import {Script} from 'node:vm';

const buyer='0x1111111111111111111111111111111111111111';
const c=config({});
const abi=new Interface(['function balanceOf(address) view returns (uint256)']);
function rpcWithUSDC(amount=20000000n,network='0xa8231'){
 const calls=[];
 const rpc=async(_,method,params=[])=>{
  calls.push(method);
  if(method==='eth_chainId')return network;
  if(method==='eth_blockNumber')return '0x300';
  if(method==='eth_getBalance')return '0x0';
  if(method==='eth_call'){
   assert.equal(params[0].to.toLowerCase(),c.asset.toLowerCase());
   assert.equal(params[1],'0x300');
   assert.equal(abi.decodeFunctionData('balanceOf',params[0].data)[0],buyer);
   return abi.encodeFunctionResult('balanceOf',[amount]);
  }
  throw Error('Unrecognized method '+method);
 };
 return {rpc,calls};
}
test('checks buyer token balance on configured Atlantic USDC, not payTo account',async()=>{
 const mock=rpcWithUSDC(20000000n);
 const o=await readBuyerBalance(c,buyer,mock.rpc);
 assert.equal(o.ok,true);
 assert.equal(o.buyer,buyer);
 assert.equal(o.asset.toLowerCase(),c.asset.toLowerCase());
 assert.equal(o.balanceUSDC,'20.0');
 assert.equal(o.eligibleForInsights,true);
 assert.equal(o.eligibleForReport,true);
 assert.ok(mock.calls.includes('eth_call'));
 assert.equal(mock.calls.includes('eth_sendRawTransaction'),false);
});
test('zero and insufficient balances report route eligibility, never claim ready',async()=>{
 const empty=await readBuyerBalance(c,buyer,rpcWithUSDC(0n).rpc);
 assert.equal(empty.balanceUSDC,'0.0');
 assert.equal(empty.eligibleForInsights,false);
 assert.equal(empty.eligibleForReport,false);
 const low=await readBuyerBalance(c,buyer,rpcWithUSDC(1200n).rpc);
 assert.equal(low.eligibleForInsights,true);
 assert.equal(low.eligibleForReport,false);
});
test('rejects invalid wallet and incorrect network before inspecting contract',async()=>{
 await assert.rejects(readBuyerBalance(c,'alice.eth',async()=>{throw Error('should not read RPC')}),/valid nonzero EVM/);
 await assert.rejects(readBuyerBalance(c,buyer,rpcWithUSDC(20000000n,'0x1').rpc),/not connected to Pharos Atlantic/);
});
test('website shows and refreshes the CURRENT buyer USDC balance before signing',()=>{
 assert.match(PAGE,/id="checkBalance"/);
 assert.match(PAGE,/id="buyerBalance"/);
 assert.match(PAGE,/checkBuyerBalance/);
 assert.match(PAGE,/accountsChanged/);
 assert.match(PAGE,/Connected buyer has only/);
 const script=PAGE.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(script);
 new Script(script[1]);
});
