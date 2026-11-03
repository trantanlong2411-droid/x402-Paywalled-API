import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {Interface,TypedDataEncoder} from 'ethers';
import {config} from '../src/config.mjs';
import {ABI,rpc} from '../src/facilitator.mjs';
const candidates=[...new Set([
 process.env.TEST_USDC_ADDRESS,
 '0xE0BE08c77f415F577A1B3A9aD7a1Df1479564ec8',
 '0xBd80E06F0325C4758e06d8a9522588363C4c75a4',
 '0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B'
].filter(Boolean))];
const first=config({ATLANTIC_RPC_URL:process.env.ATLANTIC_RPC_URL});
const chain=await rpc(first,'eth_chainId',[]);
assert.equal(BigInt(chain),688689n,'Not Atlantic Testnet');
const height=await rpc(first,'eth_blockNumber',[]);
const result={schema:'pharos-x402-atlantic-token-candidate-audit-v2',
 observedAtUtc:new Date().toISOString(),chainId:Number(BigInt(chain)),
 block:BigInt(height).toString(),candidates:[],
 note:'Live read-only verification of token candidates. A deployed ERC20 alone does not prove EIP-3009 compatibility.'};
for(const asset of candidates){
 const c=config({ATLANTIC_RPC_URL:process.env.ATLANTIC_RPC_URL,TEST_USDC_ADDRESS:asset});
 const entry={address:c.asset,hasCode:false,symbol:null,name:null,decimals:null,eip3009:false,error:null};
 try{
  const code=await rpc(c,'eth_getCode',[c.asset,'latest']);
  if(!code||code==='0x')throw Error('No contract code');
  entry.hasCode=true;
  async function call(method,args=[]){
   const res=await rpc(c,'eth_call',[{to:c.asset,data:ABI.encodeFunctionData(method,args)},'latest']);
   return ABI.decodeFunctionResult(method,res)[0];
  }
  const [symbol,name,decimals]=await Promise.all([call('symbol'),call('name'),call('decimals')]);
  entry.symbol=String(symbol);entry.name=String(name);entry.decimals=Number(decimals);
  if(entry.symbol.toUpperCase()!=='USDC'||entry.decimals!==6)throw Error('Not 6-decimal USDC');
  const used=await call('authorizationState',['0x1111111111111111111111111111111111111111','0x'+'11'.repeat(32)]);
  if(typeof used!=='boolean')throw Error('EIP3009 authorizationState not boolean');
  entry.eip3009=true;
  const domainAbi=new Interface(['function DOMAIN_SEPARATOR() view returns(bytes32)','function version() view returns(string)']);
  try{
   const v=await rpc(c,'eth_call',[{to:c.asset,data:domainAbi.encodeFunctionData('version',[])},'latest']);
   entry.domainVersion=String(domainAbi.decodeFunctionResult('version',v)[0]);
  }catch{entry.domainVersion=null;}
  try{
   const hex=await rpc(c,'eth_call',[{to:c.asset,data:domainAbi.encodeFunctionData('DOMAIN_SEPARATOR',[])},'latest']);
   const returned=domainAbi.decodeFunctionResult('DOMAIN_SEPARATOR',hex)[0];
   entry.domainSeparator=returned;
   entry.domainMatchesVersions=['1','2'].filter(v=>
    TypedDataEncoder.hashDomain({name:entry.name,version:v,chainId:688689,verifyingContract:c.asset}).toLowerCase()===String(returned).toLowerCase());
  }catch{entry.domainSeparator=null;entry.domainMatchesVersions=[];}

 }catch(e){entry.error=String(e.message||e).slice(0,170)}
 result.candidates.push(entry);
 console.log('ATLANTIC_USDC_CANDIDATE',JSON.stringify(entry));
}
result.compatible=result.candidates.filter(x=>x.eip3009);
await mkdir('proof',{recursive:true});
await writeFile('proof/atlantic-token-audit.json',JSON.stringify(result,null,2)+'\n');
console.log('ATLANTIC_TOKEN_COMPATIBILITY_AUDIT_COMPLETE',JSON.stringify({
 checked:result.candidates.length,compatible:result.compatible.map(x=>x.address),block:result.block
}));
if(!result.compatible.length)throw Error('No tested Pharos Atlantic USDC token supports EIP-3009; do not activate x402 exact!');
