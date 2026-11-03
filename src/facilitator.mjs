import {Interface,Signature,Wallet,verifyTypedData,TypedDataEncoder,keccak256,toUtf8Bytes,getAddress} from 'ethers';
import {CHAIN_ID,NETWORK,ROUTES,address,config} from './config.mjs';
import {requirement} from './protocol.mjs';

export const ABI=new Interface([
 'function name() view returns(string)',
 'function symbol() view returns(string)',
 'function decimals() view returns(uint8)',
 'function balanceOf(address) view returns(uint256)',
 'function authorizationState(address,bytes32) view returns(bool)',
 'function DOMAIN_SEPARATOR() view returns(bytes32)',
 'function transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)',
 'event Transfer(address indexed from,address indexed to,uint256 amount)'
]);
export const TYPES={TransferWithAuthorization:[
 {name:'from',type:'address'},{name:'to',type:'address'},
 {name:'value',type:'uint256'},{name:'validAfter',type:'uint256'},
 {name:'validBefore',type:'uint256'},{name:'nonce',type:'bytes32'}
]};
const quantity=x=>'0x'+BigInt(x).toString(16);
const hexBytes=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/i.test(x);
const mustHex=x=>{if(typeof x!=='string'||!/^0x[0-9a-f]+$/i.test(x))throw Error('Invalid RPC hex');return BigInt(x)};
export class PaymentError extends Error{constructor(reason){super(reason);this.name='PaymentError'}}

export async function rpc(c,method,params=[]){
 const allowed=new Set(['eth_chainId','eth_getCode','eth_call','eth_getBalance',
  'eth_gasPrice','eth_estimateGas','eth_getTransactionCount','eth_sendRawTransaction',
  'eth_getTransactionReceipt','eth_blockNumber','eth_getTransactionByHash']);
 if(!allowed.has(method))throw new Error('Forbidden JSON-RPC method');
 let last;
 for(let i=0;i<3;i++){
  try{
   const seq=crypto.getRandomValues(new Uint32Array(1))[0];
   const res=await fetch(c.rpc,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:seq,method,params}),signal:AbortSignal.timeout(13000)});
   if(!res.ok)throw Error('RPC HTTP '+res.status);
   const j=await res.json();
   if(j.error)throw Error(method+': '+String(j.error.message||'rejected').slice(0,140));
   if(j.jsonrpc!=='2.0'||j.id!==seq||j.result===undefined||j.result===null)
    throw Error('RPC returned null or unmatched id');
   return j.result;
  }catch(e){last=e;if(i<2)await new Promise(r=>setTimeout(r,600*(i+1)))}
 }
 throw Error(String(last?.message||last||'RPC unavailable').slice(0,180));
}
async function tokenRead(c,method,args=[],block='latest',transport=rpc){
 const data=ABI.encodeFunctionData(method,args);
 const output=await transport(c,'eth_call',[{to:c.asset,data},block]);
 if(typeof output!=='string'||output==='0x')throw Error('Token '+method+' returned no data');
 return ABI.decodeFunctionResult(method,output)[0];
}
export function parseSignedPayment(payload,requirements,c){
 if(!payload||typeof payload!=='object'||payload.x402Version!==2||
  payload.scheme&&payload.scheme!=='exact'||!payload.payload||!payload.accepted)
  throw new PaymentError('Invalid x402 v2 payment payload');
 const offer=payload.accepted;
 if(offer.scheme!=='exact'||offer.network!==NETWORK||
  String(offer.asset).toLowerCase()!==c.asset?.toLowerCase()||
  String(offer.payTo).toLowerCase()!==c.payTo?.toLowerCase()||
  offer.extra?.assetTransferMethod!=='eip3009'||
  offer.extra?.name!==c.domainName||offer.extra?.version!==c.domainVersion)
  throw new PaymentError('Payment network, token, destination or domain mismatch');
 const requirementToCheck=requirements;
 if(!requirementToCheck||requirementToCheck.scheme!=='exact'||
  requirementToCheck.network!==NETWORK||
  String(requirementToCheck.asset).toLowerCase()!==c.asset?.toLowerCase()||
  String(requirementToCheck.payTo).toLowerCase()!==c.payTo?.toLowerCase()||
  String(requirementToCheck.amount)!==String(offer.amount)||
  !['1000','3000'].includes(String(offer.amount))||
  requirementToCheck.extra?.name!==c.domainName||
  requirementToCheck.extra?.version!==c.domainVersion)
  throw new PaymentError('Requirement does not match accepted x402 route');
 const auth=payload.payload.authorization,signature=payload.payload.signature;
 if(!auth||!address(auth.from)||!address(auth.to)||!hexBytes(auth.nonce)||
  typeof signature!=='string'||!/^0x[0-9a-f]{130}$/i.test(signature))
  throw new PaymentError('Invalid EIP-3009 authorization or signature');
 if(address(auth.to).toLowerCase()!==c.payTo.toLowerCase()||
  !/^\d+$/.test(String(auth.value))||
  BigInt(auth.value)!==BigInt(requirementToCheck.amount)||
  !/^\d+$/.test(String(auth.validAfter))||!/^\d+$/.test(String(auth.validBefore)))
  throw new PaymentError('Bad recipient, amount or authorization window (underpaid payments rejected)');
 const now=BigInt(Math.floor(Date.now()/1000));
 if(BigInt(auth.validAfter)>now||BigInt(auth.validBefore)<=now||
  BigInt(auth.validBefore)-BigInt(auth.validAfter)>3600n||
  BigInt(auth.validBefore)-now>BigInt(requirementToCheck.maxTimeoutSeconds||300))
  throw new PaymentError('Payment authorization expired, not yet valid or exceeds timeout');
 const domain={name:c.domainName,version:c.domainVersion,chainId:CHAIN_ID,verifyingContract:c.asset};
 const value={from:address(auth.from),to:address(auth.to),value:String(auth.value),
  validAfter:String(auth.validAfter),validBefore:String(auth.validBefore),nonce:auth.nonce};
 let recovered;
 try{recovered=verifyTypedData(domain,TYPES,value,signature)}
 catch{throw new PaymentError('Invalid EIP-712 signature')}
 if(recovered.toLowerCase()!==value.from.toLowerCase())
  throw new PaymentError('Signature does not match payer');
 const sig=Signature.from(signature);
 const calldata=ABI.encodeFunctionData('transferWithAuthorization',[
  value.from,value.to,BigInt(value.value),BigInt(value.validAfter),BigInt(value.validBefore),
  value.nonce,sig.v,sig.r,sig.s]);
 const paymentId=keccak256(toUtf8Bytes(NETWORK+':'+c.asset.toLowerCase()+':'+
  value.from.toLowerCase()+':'+value.nonce.toLowerCase()));
 return {payer:value.from,auth:value,calldata,paymentId,signature};
}
export async function verifyPayment(payload,requirements,c,transport=rpc){
 try{
  if(!c.ready)throw new PaymentError('Facilitator not configured');
  const decoded=parseSignedPayment(payload,requirements,c);
  const network=mustHex(await transport(c,'eth_chainId',[]));
  if(network!==BigInt(CHAIN_ID))throw new PaymentError('Wrong Pharos network');
  const block=await transport(c,'eth_blockNumber',[]);
  mustHex(block);
  const code=await transport(c,'eth_getCode',[c.asset,block]);
  if(typeof code!=='string'||code==='0x')throw new PaymentError('Test USDC contract unavailable');
  const [symbol,decimals,name,balance,used,domainSeparator]=await Promise.all([
   tokenRead(c,'symbol',[],block,transport),
   tokenRead(c,'decimals',[],block,transport),
   tokenRead(c,'name',[],block,transport),
   tokenRead(c,'balanceOf',[decoded.payer],block,transport),
   tokenRead(c,'authorizationState',[decoded.payer,decoded.auth.nonce],block,transport),
   tokenRead(c,'DOMAIN_SEPARATOR',[],block,transport)
  ]);
  if(String(symbol).toUpperCase()!=='USDC'||Number(decimals)!==6||
   String(name)!==c.domainName)throw new PaymentError('Test token metadata/domain mismatch');
  const actualDomain=TypedDataEncoder.hashDomain({
   name:c.domainName,version:c.domainVersion,chainId:CHAIN_ID,verifyingContract:c.asset
  });
  if(String(domainSeparator).toLowerCase()!==actualDomain.toLowerCase())
   throw new PaymentError('Token DOMAIN_SEPARATOR does not match EIP-712 signature domain');
  if(Boolean(used))throw new PaymentError('Authorization nonce was already spent');
  if(BigInt(balance)<BigInt(decoded.auth.value))throw new PaymentError('Insufficient test USDC balance');
  // Simulate the exact calldata from the relayer; refuse a contract that lacks EIP-3009.
  await transport(c,'eth_call',[{from:c.relayer,to:c.asset,data:decoded.calldata},block]);
  return {isValid:true,payer:decoded.payer,paymentId:decoded.paymentId,
   calldata:decoded.calldata,block:mustHex(block).toString()};
 }catch(e){
  return {isValid:false,payer:null,invalidReason:String(e.message||e).slice(0,200)};
 }
}
export async function verifyForRoute(payload,path,c,transport=rpc){
 if(!ROUTES[path])return {isValid:false,invalidReason:'Unknown route'};
 return verifyPayment(payload,requirement(path,c),c,transport);
}
export function verifyReceipt(receipt,transaction,decoded,c,requiredAmount){
 if(!receipt||mustHex(receipt.status)!==1n||!transaction||
  String(transaction.to).toLowerCase()!==c.asset.toLowerCase()||
  String(transaction.from).toLowerCase()!==c.relayer.toLowerCase()||
  String(transaction.input||transaction.data||'').toLowerCase()!==decoded.calldata.toLowerCase())
  return false;
 const target=BigInt(requiredAmount);
 return (receipt.logs||[]).some(log=>{
  if(String(log.address||'').toLowerCase()!==c.asset.toLowerCase())return false;
  try{const ev=ABI.parseLog({topics:log.topics,data:log.data});
   return ev?.name==='Transfer'&&
    String(ev.args[0]).toLowerCase()===decoded.payer.toLowerCase()&&
    String(ev.args[1]).toLowerCase()===c.payTo.toLowerCase()&&
    BigInt(ev.args[2])===target;
  }catch{return false}
 });
}
export async function settlePayment(payload,requirements,c,ledger,transport=rpc){
 if(!c.ready||!ledger)return {success:false,errorReason:'Facilitator is not configured',network:NETWORK,transaction:null};
 const verified=await verifyPayment(payload,requirements,c,transport);
 if(!verified.isValid)return {success:false,errorReason:verified.invalidReason,network:NETWORK,transaction:null};
 const decoded=parseSignedPayment(payload,requirements,c);
 const lock=await ledger.fetch(new Request('https://ledger.internal/claim',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify({id:decoded.paymentId})}));
 const l=await lock.json();
 if(!l.claimed)return {success:false,errorReason:'Payment authorization already used or reserved',
  transaction:l.transaction||null,network:NETWORK};
 // Do not release the lock on uncertain broadcast outcome: fail closed against replay/double-charge.
 let hash=null;
 try{
  const key=new Wallet(c.relayKey);
  if(key.address.toLowerCase()!==c.relayer.toLowerCase())throw Error('Relayer key changed');
  const [gasPriceHex,gasLimitHex,nonceHex,balanceHex]=await Promise.all([
   transport(c,'eth_gasPrice',[]),
   transport(c,'eth_estimateGas',[{from:c.relayer,to:c.asset,data:decoded.calldata,value:'0x0'}]),
   transport(c,'eth_getTransactionCount',[c.relayer,'pending']),
   transport(c,'eth_getBalance',[c.relayer,'latest'])
  ]);
  const gas=(mustHex(gasLimitHex)*120n+99n)/100n;
  const price=mustHex(gasPriceHex);
  if(gas===0n||price===0n||mustHex(balanceHex)<gas*price)throw Error('Facilitator lacks test PHRS gas');
  const raw=await key.signTransaction({
   chainId:CHAIN_ID,to:c.asset,data:decoded.calldata,value:0n,
   nonce:Number(mustHex(nonceHex)),gasLimit:gas,gasPrice:price,type:0
  });
  // Record a known deterministic transaction hash before the node sees it.
  hash=keccak256(raw);
  await ledger.fetch(new Request('https://ledger.internal/update',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({id:decoded.paymentId,transaction:hash,status:'broadcasting'})}));
  const sent=await transport(c,'eth_sendRawTransaction',[raw]);
  if(String(sent).toLowerCase()!==hash.toLowerCase())throw Error('RPC returned unexpected transaction hash');
  for(let i=0;i<12;i++){
   const receipt=await transport(c,'eth_getTransactionReceipt',[hash]);
   if(receipt){
    const tx=await transport(c,'eth_getTransactionByHash',[hash]);
    const valid=verifyReceipt(receipt,tx,decoded,c,requirements.amount);
    await ledger.fetch(new Request('https://ledger.internal/update',{method:'POST',
     headers:{'content-type':'application/json'},body:JSON.stringify({id:decoded.paymentId,
      transaction:hash,status:valid?'settled':'failed'})}));
    return {success:valid,network:NETWORK,transaction:hash,payer:decoded.payer,
     ...(!valid?{errorReason:'Confirmed transaction failed settlement checks'}:{})};
   }
   await new Promise(r=>setTimeout(r,1800));
  }
  return {success:false,network:NETWORK,transaction:hash,payer:decoded.payer,
   errorReason:'settlement_pending'};
 }catch(e){
  return {success:false,network:NETWORK,transaction:hash,payer:decoded.payer,
   errorReason:hash?'settlement_pending_or_unconfirmed':'Settlement blocked: '+String(e.message||e).slice(0,130)};
 }
}
