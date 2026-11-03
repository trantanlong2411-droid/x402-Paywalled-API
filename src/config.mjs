import {getAddress,Wallet} from 'ethers';
export const CHAIN_ID=688689;
export const NETWORK='eip155:688689';
export const RPC_DEFAULT='https://atlantic.dplabs-internal.com';
export const USDC_DEFAULT='0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B';
export const EXPLORER='https://atlantic.pharosscan.xyz/tx/';
export const ROUTES={
 '/api/insights':{amount:'1000',price:'0.001',description:'Pharos Atlantic market insights',kind:'insights'},
 '/api/report':{amount:'3000',price:'0.003',description:'Pharos Atlantic API analytics report',kind:'report'}
};
export function address(x){try{return getAddress(String(x||''))}catch{return null}}
export function config(env={}){
 const relayKey=typeof env.FACILITATOR_PRIVATE_KEY==='string'&&/^0x[0-9a-fA-F]{64}$/.test(env.FACILITATOR_PRIVATE_KEY)?env.FACILITATOR_PRIVATE_KEY:null;
 let relayer=null;try{if(relayKey)relayer=new Wallet(relayKey).address}catch{}
 const payTo=address(env.PAY_TO_ADDRESS||relayer);
 const asset=address(env.TEST_USDC_ADDRESS||USDC_DEFAULT);
 const name=String(env.USDC_DOMAIN_NAME||'USDC').trim();
 const version=String(env.USDC_DOMAIN_VERSION||'2').trim();
 const rpc=String(env.ATLANTIC_RPC_URL||RPC_DEFAULT);
 const ready=Boolean(relayer&&payTo&&asset&&env.PAYMENT_LEDGER&&/^https:\/\//.test(rpc)&&name&&version);
 return {ready,chainId:CHAIN_ID,network:NETWORK,rpc,asset,payTo,relayer,
  relayKey,domainName:name,domainVersion:version,hasLedger:Boolean(env.PAYMENT_LEDGER)};
}
export function publicConfig(c){return {chainId:c.chainId,network:c.network,asset:c.asset,
 payTo:c.payTo,facilitator:c.relayer,configured:c.ready,
 hasSecret:Boolean(c.relayer),durableReplayProtection:c.hasLedger,
 domain:{name:c.domainName,version:c.domainVersion},
 routes:Object.entries(ROUTES).map(([path,r])=>({path,price:r.price+' test USDC',amount:r.amount}))};}
