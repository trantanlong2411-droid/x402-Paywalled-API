import test from 'node:test';
import assert from 'node:assert/strict';
import {Wallet,TypedDataEncoder,Transaction,keccak256} from 'ethers';
import {config,CHAIN_ID} from '../src/config.mjs';
import {requirement} from '../src/protocol.mjs';
import {ABI,TYPES,parseSignedPayment,verifyPayment,verifyReceipt,settlePayment} from '../src/facilitator.mjs';
function fixture(){
 const payer=Wallet.createRandom(),relay=Wallet.createRandom(),seller=Wallet.createRandom();
 const c=config({FACILITATOR_PRIVATE_KEY:relay.privateKey,PAY_TO_ADDRESS:seller.address,
  PAYMENT_LEDGER:{test:true}});
 const req=requirement('/api/insights',c);
 return {payer,relay,seller,c,req};
}
async function signed(f,opts={}){
 const now=Math.floor(Date.now()/1000);
 const authorization={from:f.payer.address,to:f.c.payTo,
  value:opts.value??f.req.amount,validAfter:String(now-30),
  validBefore:String(now+240),nonce:'0x'+'11'.repeat(32)};
 const accepted={...f.req};
 const domain={name:f.c.domainName,version:f.c.domainVersion,
  chainId:CHAIN_ID,verifyingContract:f.c.asset};
 const signature=await f.payer.signTypedData(domain,TYPES,authorization);
 return {x402Version:2,resource:{url:'https://example.com/api/insights'},
  accepted,payload:{signature,authorization}};
}
function mock(f,{balance=3000000n,nonceUsed=false,wrongChain=false,simulationFails=false}={}){
 const methods=[];
 const transport=async(c,method,params=[])=>{
  methods.push(method);
  if(method==='eth_chainId')return wrongChain?'0x1':'0xa8231';
  if(method==='eth_blockNumber')return '0x1234';
  if(method==='eth_getCode')return '0x608060';
  if(method==='eth_call'){
   if(params[0]?.from){
    if(simulationFails)throw Error('execution reverted');
    return '0x';
   }
   const parsed=ABI.parseTransaction({data:params[0].data});
   if(parsed.name==='symbol')return ABI.encodeFunctionResult('symbol',['USDC']);
   if(parsed.name==='decimals')return ABI.encodeFunctionResult('decimals',[6]);
   if(parsed.name==='name')return ABI.encodeFunctionResult('name',[f.c.domainName]);
   if(parsed.name==='balanceOf')return ABI.encodeFunctionResult('balanceOf',[balance]);
   if(parsed.name==='authorizationState')return ABI.encodeFunctionResult('authorizationState',[nonceUsed]);
   if(parsed.name==='DOMAIN_SEPARATOR')return ABI.encodeFunctionResult('DOMAIN_SEPARATOR',[
    TypedDataEncoder.hashDomain({name:f.c.domainName,version:f.c.domainVersion,
     chainId:CHAIN_ID,verifyingContract:f.c.asset})
   ]);
   throw Error('Unexpected mock method '+parsed.name);
  }
  throw Error('Unexpected JSON RPC method '+method);
 };
 return {transport,methods};
}
test('valid EIP-712 signature binds payer, destination, exact amount, token and chain',async()=>{
 const f=fixture(),p=await signed(f);
 const checked=parseSignedPayment(p,f.req,f.c);
 assert.equal(checked.payer,f.payer.address);
 assert.ok(checked.calldata.startsWith('0xe3ee160e'));
 assert.match(checked.paymentId,/^0x[0-9a-f]{64}$/);
 const m=mock(f);const verified=await verifyPayment(p,f.req,f.c,m.transport);
 assert.equal(verified.isValid,true,JSON.stringify(verified));
 assert.equal(verified.payer,f.payer.address);
 assert.ok(m.methods.includes('eth_call'));
});
test('underpaid and changed amount are rejected before RPC',async()=>{
 const f=fixture(),p=await signed(f,{value:'999'});
 assert.throws(()=>parseSignedPayment(p,f.req,f.c),/underpaid|amount/i);
 const r=await verifyPayment(p,f.req,f.c,async()=>{throw Error('network should not run')});
 assert.equal(r.isValid,false);
 const correct=await signed(f);
 correct.accepted.amount='3000';
 assert.throws(()=>parseSignedPayment(correct,f.req,f.c),/Requirement does not match/);
});
test('wrong payee, mismatched domain, wrong network, invalid signature rejected',async()=>{
 const f=fixture(),p=await signed(f);
 const changed={...p,accepted:{...p.accepted,payTo:Wallet.createRandom().address}};
 assert.throws(()=>parseSignedPayment(changed,f.req,f.c),/mismatch/);
 const changedDomain={...p,accepted:{...p.accepted,extra:{...p.accepted.extra,name:'Fake'}}};
 assert.throws(()=>parseSignedPayment(changedDomain,f.req,f.c),/mismatch/);
 const changedNetwork={...p,accepted:{...p.accepted,network:'eip155:1672'}};
 assert.throws(()=>parseSignedPayment(changedNetwork,f.req,f.c),/mismatch/);
 const badSig={...p,payload:{...p.payload,signature:'0x'+'ab'.repeat(65)}};
 assert.throws(()=>parseSignedPayment(badSig,f.req,f.c),/signature|match|point/i);
});
test('expired and already-used authorizations are refused',async()=>{
 const f=fixture(),p=await signed(f);
 const expired={...p,payload:{...p.payload,authorization:{...p.payload.authorization,validBefore:'1'}}};
 assert.throws(()=>parseSignedPayment(expired,f.req,f.c),/expired/);
 const v=await verifyPayment(p,f.req,f.c,mock(f,{nonceUsed:true}).transport);
 assert.equal(v.isValid,false);
 assert.match(v.invalidReason,/already spent/);
});
test('no balance, wrong chain, failed onchain simulation cause invalid verification',async()=>{
 const f=fixture(),p=await signed(f);
 for(const mode of [{balance:0n},{wrongChain:true},{simulationFails:true}]){
  const v=await verifyPayment(p,f.req,f.c,mock(f,mode).transport);
  assert.equal(v.isValid,false);
 }
});
test('receipt only accepted with matching real Transfer event and relayer transaction',async()=>{
 const f=fixture(),p=await signed(f);
 const d=parseSignedPayment(p,f.req,f.c);
 const ev=ABI.encodeEventLog(ABI.getEvent('Transfer'),[f.payer.address,f.seller.address,1000n]);
 const tx={to:f.c.asset,from:f.relay.address,input:d.calldata};
 const rec={status:'0x1',logs:[{address:f.c.asset,topics:ev.topics,data:ev.data}]};
 assert.equal(verifyReceipt(rec,tx,d,f.c,'1000'),true);
 assert.equal(verifyReceipt({...rec,status:'0x0'},tx,d,f.c,'1000'),false);
 assert.equal(verifyReceipt({...rec,logs:[]},tx,d,f.c,'1000'),false);
 assert.equal(verifyReceipt(rec,{...tx,from:f.payer.address},d,f.c,'1000'),false);
});

test('full mocked x402 signed settlement constructs a real signed relayer transaction and blocks replay',async()=>{
 const f=fixture(),payment=await signed(f);
 const initial=mock(f);
 let rawTransaction=null,parsedTx=null,transactionHash=null;
 const transfer=ABI.encodeEventLog(ABI.getEvent('Transfer'),[
  f.payer.address,f.c.payTo,1000n]);
 const transport=async(c,method,params=[])=>{
  if(['eth_chainId','eth_blockNumber','eth_getCode','eth_call'].includes(method))
   return initial.transport(c,method,params);
  if(method==='eth_gasPrice')return '0x3b9aca00';
  if(method==='eth_estimateGas')return '0x30d40';
  if(method==='eth_getTransactionCount')return '0x4';
  if(method==='eth_getBalance')return '0xde0b6b3a7640000';
  if(method==='eth_sendRawTransaction'){
   rawTransaction=params[0];parsedTx=Transaction.from(rawTransaction);
   transactionHash=keccak256(rawTransaction);return transactionHash;
  }
  if(method==='eth_getTransactionReceipt')return {
   status:'0x1',transactionHash,logs:[{
    address:c.asset,topics:transfer.topics,data:transfer.data
   }]
  };
  if(method==='eth_getTransactionByHash')return {
   to:parsedTx.to,from:parsedTx.from,input:parsedTx.data,
   hash:transactionHash
  };
  throw Error('Unexpected method '+method);
 };
 const used=new Set(),updates=[];
 const ledger={async fetch(req){
  const action=new URL(req.url).pathname,input=await req.json();
  if(action==='/claim'){
   if(used.has(input.id))return Response.json({claimed:false});
   used.add(input.id);return Response.json({claimed:true});
  }
  updates.push(input);return Response.json({updated:true});
 }};
 const result=await settlePayment(payment,f.req,f.c,ledger,transport);
 assert.equal(result.success,true,JSON.stringify(result));
 assert.match(result.transaction,/^0x[0-9a-f]{64}$/);
 assert.equal(result.network,'eip155:688689');
 assert.equal(parsedTx.chainId,688689n);
 assert.equal(parsedTx.from.toLowerCase(),f.relay.address.toLowerCase());
 assert.equal(parsedTx.to.toLowerCase(),f.c.asset.toLowerCase());
 assert.ok(parsedTx.data.startsWith('0xe3ee160e'));
 assert.ok(updates.some(x=>x.status==='settled'));
 assert.ok(!JSON.stringify(result).includes(f.relay.privateKey));
 const duplicate=await settlePayment(payment,f.req,f.c,ledger,transport);
 assert.equal(duplicate.success,false);
 assert.match(duplicate.errorReason,/already used|reserved/);
});
