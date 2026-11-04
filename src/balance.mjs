import {formatUnits} from 'ethers';
import {address,CHAIN_ID} from './config.mjs';
import {ABI,rpc} from './facilitator.mjs';

// Read-only address balance inspection for the website's connected buyer.
// No wallet access, signing, payment authorization, or private key is needed.
export async function readBuyerBalance(config,buyer,transport=rpc){
 const wallet=address(buyer);
 if(!wallet||wallet==='0x0000000000000000000000000000000000000000')
  throw new Error('Enter a valid nonzero EVM buyer address');
 if(!config.asset)throw new Error('USDC contract is not configured');
 const [chainId,block]=await Promise.all([
  transport(config,'eth_chainId',[]),transport(config,'eth_blockNumber',[])
 ]);
 if(BigInt(chainId)!==BigInt(CHAIN_ID))throw new Error('RPC is not connected to Pharos Atlantic Testnet');
 const call=ABI.encodeFunctionData('balanceOf',[wallet]);
 const [tokenResult,nativeResult]=await Promise.all([
  transport(config,'eth_call',[{to:config.asset,data:call},block]),
  transport(config,'eth_getBalance',[wallet,block])
 ]);
 if(typeof tokenResult!=='string'||tokenResult==='0x')throw new Error('Test USDC contract did not return a balance');
 const tokenRaw=ABI.decodeFunctionResult('balanceOf',tokenResult)[0];
 const nativeRaw=BigInt(nativeResult);
 return {
  ok:true,network:'eip155:688689',block:BigInt(block).toString(),
  buyer:wallet,asset:config.asset,
  balanceUSDC:formatUnits(tokenRaw,6),
  balancePHRS:formatUnits(nativeRaw,18),
  eligibleForInsights:tokenRaw>=1000n,
  eligibleForReport:tokenRaw>=3000n,
  note:'Live read-only balance on the USDC contract used by this x402 Worker; balances may change before signed settlement.'
 };
}
