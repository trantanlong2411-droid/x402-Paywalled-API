import {ROUTES,NETWORK,EXPLORER} from './config.mjs';
export function b64(data){return btoa(JSON.stringify(data))}
export function unb64(value){
 if(typeof value!=='string'||value.length>14000)throw Error('Invalid payment header');
 const parsed=JSON.parse(atob(value));
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Malformed payment payload');
 return parsed;
}
export function requirement(route,c){
 if(!ROUTES[route])throw Error('Unknown paid route');
 return {scheme:'exact',network:NETWORK,amount:ROUTES[route].amount,
  asset:c.asset,payTo:c.payTo,maxTimeoutSeconds:300,
  extra:{assetTransferMethod:'eip3009',name:c.domainName,version:c.domainVersion}};
}
export function required(url,route,c){
 return {x402Version:2,error:'Payment required',resource:{
  url,description:ROUTES[route].description,mimeType:'application/json'
 },accepts:[requirement(route,c)]};
}
export function paymentResponse(tx,payer){
 return {success:true,transaction:tx,network:NETWORK,payer,explorer:EXPLORER+tx};
}
export const apiHeaders={'cache-control':'no-store','x-content-type-options':'nosniff',
 'access-control-expose-headers':'PAYMENT-REQUIRED, PAYMENT-RESPONSE'};
export function json(data,status=200,headers={}){
 return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8',
  ...apiHeaders,...headers}});
}
export function challenge(url,path,c,reason='Payment required'){
 const x=required(url,path,c);x.error=reason;
 return json(x,402,{'PAYMENT-REQUIRED':b64(x)});
}
