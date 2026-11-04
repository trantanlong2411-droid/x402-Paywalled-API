export const PAGE=String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>x402 Paywalled API | Pharos Atlantic</title>
<meta name="description" content="Self-hosted x402 v2 exact on Pharos Atlantic Testnet: two paid APIs, a free endpoint, facilitator and signed test USDC payment demo.">
<style>
:root{color-scheme:dark;--bg:#081127;--panel:#122440;--line:#335176;--muted:#a7bbdb;--cyan:#7ae5df;--blue:#bccbff;--red:#ffabaf;--yellow:#ffe0a1}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 6% -18%,#28416a,#0c1a33 49%,#081127 90%);color:#edf5ff;font:14px/1.6 system-ui,Segoe UI,sans-serif}
main{max-width:1160px;margin:auto;padding:24px 22px 65px}header,.row{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
header{font-size:12px;letter-spacing:.06em}a{color:var(--blue)}h1{font-size:clamp(43px,7.6vw,79px);letter-spacing:-.065em;line-height:1.03;margin:54px 0 17px}
h1 em{font-style:normal;color:var(--blue)}.lead{max-width:850px;color:var(--muted);font-size:18px}
.tag{border:1px solid #517299;border-radius:99px;padding:4px 10px;letter-spacing:0}.notice{border:1px solid #816f45;background:#302a26;border-radius:12px;color:#ffe2a9;padding:15px;margin:23px 0}
.steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:24px 0}.step{border:1px solid #3d5b7c;background:#122542;border-radius:12px;padding:14px}.step b{color:var(--cyan);display:block}.step small{color:var(--muted)}
.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.panel{background:rgba(19,33,60,.97);border:1px solid var(--line);border-radius:16px;padding:22px;margin-bottom:16px}
h2{font-size:22px;margin:0 0 10px}h3{font-size:17px;margin:12px 0 5px}.small,small{color:var(--muted);font-size:12px}p{margin:8px 0}
button{border:0;border-radius:10px;background:#b9ccff;color:#07162b;font-weight:760;padding:11px 14px;cursor:pointer}
button.secondary{background:#365477;color:#f4f8ff}button:disabled{opacity:.4;cursor:not-allowed}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.paid{padding:15px;margin:11px 0;border:1px solid #3a5376;border-radius:11px;background:#0a1a33}
.paid b{display:block;font-size:18px}.paid small{display:block}.paid .actions{margin-bottom:0}
.banner{border:1px solid #3d5e80;background:#0b1a32;border-radius:10px;padding:12px;margin:13px 0;overflow-wrap:anywhere}
.ok{color:var(--cyan)}.err{color:var(--red)}.warn{color:var(--yellow)}
pre{background:#07152a;border:1px solid #2f4c6c;border-radius:10px;padding:14px;max-height:365px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,Consolas,monospace}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #334967;text-align:left;padding:9px;vertical-align:top;font-size:12px}
code{color:#d1dcff;overflow-wrap:anywhere}footer{margin-top:35px;font-size:12px;color:var(--muted)}
@media(max-width:860px){.grid{grid-template-columns:1fr}.steps{grid-template-columns:1fr 1fr}}
@media(max-width:540px){main{padding:17px 13px}.steps{grid-template-columns:1fr}.panel{padding:16px}h1{margin-top:30px}}
</style></head><body><main>
<header><span>PHAROS / AGENT ARENA <span class="tag">MEDIUM · PAYMENTS</span></span><a href="https://github.com/trantanlong2411-droid/x402-Paywalled-API" target="_blank" rel="noopener">Source & CI ↗</a></header>
<h1>x402 <em>PAYWALLED API</em></h1>
<p class="lead">HTTP-native payments on Pharos Atlantic Testnet. Request a paid API, receive <b>402 Payment Required</b>, authorize exact test-USDC payment with your wallet and receive data after a verified on-chain settlement.</p>
<div class="notice"><b>Testnet only — real signatures and test-token transfers.</b> Clicking Preview 402 or Check health never pays. Clicking Pay requires your wallet to approve an EIP-712 signature; a configured facilitator then submits the transfer using testnet PHRS. Do not use a mainnet wallet or real money. The page never asks for private keys.</div>
<div class="steps">
<div class="step"><b>01 · 402</b><small>Paid API challenges your client</small></div>
<div class="step"><b>02 · SIGN</b><small>Client signs exact test-USDC authorization</small></div>
<div class="step"><b>03 · SETTLE</b><small>Own facilitator verifies & submits</small></div>
<div class="step"><b>04 · 200</b><small>Data + PAYMENT-RESPONSE & explorer TX</small></div>
</div>
<div class="grid">
<div>
<section class="panel">
<div class="row"><h2>01 / API playground</h2><button id="connect" class="secondary">Connect testnet wallet</button></div>
<p id="wallet" class="small">Wallet not connected.</p>
<div class="banner" id="buyerBalance" role="status">Buyer balance not checked. Connect your wallet and select Check USDC balance after faucet.</div>
<div class="actions"><button id="checkBalance" class="secondary">Check buyer USDC balance</button></div>
<p id="configStatus" class="banner">Loading Worker configuration…</p>
<div class="paid"><b>/health <span class="ok">FREE</span></b><small>Live endpoint and readiness without payment.</small>
<div class="actions"><button id="health" class="secondary">Get free health</button></div></div>
<div class="paid"><b>/api/insights <span class="warn">0.001 test USDC</span></b><small>Paid endpoint 1 · 1,000 token base units.</small>
<div class="actions"><button id="previewA" class="secondary">Preview 402</button><button id="payA">Pay & get insights</button></div></div>
<div class="paid"><b>/api/report <span class="warn">0.003 test USDC</span></b><small>Paid endpoint 2 · 3,000 token base units.</small>
<div class="actions"><button id="previewB" class="secondary">Preview 402</button><button id="payB">Pay & get report</button></div></div>
<p id="status" class="banner" role="status">Choose Preview 402 to inspect the payment challenge without signing.</p>
<h3>Request / response</h3><pre id="result">Waiting for request…</pre>
<div id="linkBox"></div>
</section>
<section class="panel">
<h2>02 / Transaction proof</h2>
<pre id="proof">A successful signed testnet payment will display HTTP 200, PAYMENT-RESPONSE, transaction hash and explorer link here. Nothing is simulated.</pre>
<div class="actions"><button id="copy" class="secondary">Copy evidence JSON</button></div>
</section>
</div>
<aside>
<section class="panel"><h2>03 / Facilitator</h2>
<table><thead><tr><th>Operation</th><th>What it does</th></tr></thead><tbody>
<tr><td><code>GET /supported</code></td><td>Advertises exact x402 v2 only when ready</td></tr>
<tr><td><code>POST /verify</code></td><td>Checks EIP-712 signature, expiry, nonce, balance and contract simulation</td></tr>
<tr><td><code>POST /settle</code></td><td>Reserves the authorization, signs a gas-funded relayer transaction and checks the receipt</td></tr>
</tbody></table>
<div class="actions"><button id="supported" class="secondary">Check /supported</button></div>
<p class="small">A durable payment ledger prevents a previously consumed authorization from unlocking the API again. The client cannot force a 200 by submitting an arbitrary hash.</p>
<h3>Network details</h3>
<p>Pharos Atlantic Testnet<br><code>eip155:688689</code><br>Gas: PHRS (testnet)<br>Asset: configurable EIP-3009 test USDC</p>
<p><a href="https://atlantic.pharosscan.xyz" target="_blank" rel="noopener">Atlantic explorer ↗</a></p><p><a href="https://faucet.circle.com/" target="_blank" rel="noopener">Claim Circle test USDC ↗</a></p><p><a href="https://pharos.faucetme.pro/" target="_blank" rel="noopener">Get PHRS for relayer gas ↗</a></p>
</section>
<section class="panel">
<h2>04 / Reviewer guide</h2>
<p>1. Click <b>Get free health</b> (HTTP 200).</p>
<p>2. Click <b>Preview 402</b> on both priced endpoints and compare the different amount requirements.</p>
<p>3. Configure testnet wallets if necessary (seller/relayer secrets must stay in Cloudflare).</p>
<p>4. Click <b>Pay & get</b>, approve the wallet's EIP-712 signature and inspect the resulting HTTP 200 with PAYMENT-RESPONSE and the explorer transaction.</p>
<p>5. Invalid, underpaid, expired or reused authorizations return HTTP 402.</p>
<p class="small">Until the facilitator is configured and funded, signed settlement is unavailable. This page does not claim a successful paid transaction without explorer proof.</p>
</section>
</aside>
</div>
<footer>x402 Paywalled API · Pharos Atlantic Testnet · v2 exact EIP-3009 · no keys in source · real verification/settlement only · test tokens have no mainnet value.</footer>
</main><script>
(function(){
 const $=id=>document.getElementById(id);
 let config=null,wallet=null,lastProof=null;
 const status=t=>{$('status').textContent=t};
 const print=(x)=>{$('result').textContent=typeof x==='string'?x:JSON.stringify(x,null,2)};
 const b64=x=>btoa(JSON.stringify(x));
 const unb64=x=>JSON.parse(atob(x));
 async function settings(){
  try{
   const r=await fetch('/api/config');const j=await r.json();config=j.config;
   $('configStatus').textContent=j.ready?'FACILITATOR READY · Chain 688689 · '+j.config.asset:
    'CONFIGURATION REQUIRED · Add facilitator private key and payment receiver to Cloudflare secrets. Preview remains available when ready.';
   $('configStatus').className='banner '+(j.ready?'ok':'warn');
  }catch(e){$('configStatus').textContent='Cannot read deployment configuration: '+e.message}
 }
 async function preview(path){
  status('Requesting '+path+' without payment. This never signs or moves test tokens.');
  const res=await fetch(path,{cache:'no-store'});
  const challenge=res.headers.get('PAYMENT-REQUIRED');
  let decoded=null;
  if(challenge){try{decoded=unb64(challenge)}catch{}}
  print({status:res.status,paymentRequired:decoded,body:await res.json()});
  if(res.status===402)status('HTTP 402 Payment Required confirmed for '+path+'. No payment made.');
  else status('HTTP '+res.status+' from '+path+'. Check facilitator readiness.');
  return {res,decoded};
 }
 async function ensureWallet(){
  if(!window.ethereum)throw Error('No EVM wallet extension detected. Install a wallet supporting Pharos Atlantic Testnet.');
  const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
  if(!accounts?.length)throw Error('No wallet account authorized');
  const id='0x'+(688689).toString(16);
  let current=await window.ethereum.request({method:'eth_chainId'});
  if(String(current).toLowerCase()!==id){
   try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:id}]})}
   catch(e){
    if(e.code!==4902)throw e;
    await window.ethereum.request({method:'wallet_addEthereumChain',params:[{
     chainId:id,chainName:'Pharos Atlantic Testnet',
     rpcUrls:['https://atlantic.dplabs-internal.com'],
     nativeCurrency:{name:'PHRS',symbol:'PHRS',decimals:18},
     blockExplorerUrls:['https://atlantic.pharosscan.xyz']
    }]});
   }
  }
  wallet=accounts[0];$('wallet').textContent='Wallet: '+wallet+' · Atlantic Testnet';
  return wallet;
 }
 async function checkBuyerBalance(){
  const target=$('buyerBalance');
  try{
   const account=await ensureWallet();
   target.textContent='Checking USDC at the x402 contract on Atlantic…';
   const res=await fetch('/api/balance?address='+encodeURIComponent(account),{cache:'no-store'});
   const data=await res.json();
   if(!res.ok||!data.ok)throw Error(data.error||'Balance unavailable');
   const label='Buyer '+data.buyer+' · '+data.balanceUSDC+' USDC · '+data.balancePHRS+
    ' PHRS · block '+data.block+'. ';
   target.textContent=label+(data.eligibleForReport?
    'Enough USDC for both paid routes.':
    data.eligibleForInsights?
      'Enough for 0.001 USDC insights, but not the 0.003 USDC report.':
      'Not enough USDC for either paid route. Faucet to THIS exact buyer address on Pharos Testnet.');
   target.className='banner '+(data.eligibleForInsights?'ok':'warn');
   return data;
  }catch(e){
   target.className='banner warn';
   target.textContent='Cannot check buyer balance: '+e.message;
   return null;
  }
 }
 $('connect').onclick=async()=>{
  try{
   await ensureWallet();status('Connected on Atlantic Testnet. Checking USDC balance…');
   await checkBuyerBalance();
  }catch(e){status('Connection failed: '+e.message)}
 };
 $('checkBalance').onclick=checkBuyerBalance;
 if(window.ethereum?.on){
  window.ethereum.on('accountsChanged',accounts=>{
   wallet=null;
   $('wallet').textContent=accounts.length?'Wallet account changed. Recheck balance.':'Wallet disconnected.';
   $('buyerBalance').textContent='Wallet changed; click Check buyer USDC balance before paying.';
  });
  window.ethereum.on('chainChanged',()=>{
   wallet=null;
   $('buyerBalance').textContent='Network changed; reconnect on Atlantic Testnet.';
  });
 }
 async function paid(path){
  lastProof=null;$('linkBox').replaceChildren();
  if(!config?.configured){status('Facilitator is not ready. Connect Cloudflare payment secrets first.');return}
  try{
   const offer=await preview(path);
   if(offer.res.status!==402||!offer.decoded?.accepts?.length)
    throw Error('Expected an x402 402 challenge before signing');
   const requirement=offer.decoded.accepts[0];
   if(requirement.network!=='eip155:688689'||requirement.scheme!=='exact')
    throw Error('Wrong network/scheme in payment request');
   if(requirement.asset.toLowerCase()!==config.asset.toLowerCase()||
     requirement.payTo.toLowerCase()!==config.payTo.toLowerCase())
    throw Error('Payment recipient or token differs from server configuration');
   const account=await ensureWallet();
   const observed=await checkBuyerBalance();
   if(!observed||observed.buyer.toLowerCase()!==account.toLowerCase())
    throw Error('Could not verify the connected buyer wallet balance.');
   if(!(path==='/api/report'?observed.eligibleForReport:observed.eligibleForInsights))
    throw Error('Connected buyer has only '+observed.balanceUSDC+' USDC at contract '+observed.asset+
      '. Confirm your Circle faucet recipient matches '+observed.buyer+' and retry after the balance appears.');
   const price=Number(requirement.amount)/1000000;
   if(!confirm('Authorize '+price+' TEST USDC on Pharos Atlantic to '+requirement.payTo+'? The facilitator will settle on-chain.'))return;
   const now=Math.floor(Date.now()/1000);
   const nonce='0x'+Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const authorization={from:account,to:requirement.payTo,
    value:String(requirement.amount),validAfter:String(now-30),validBefore:String(now+240),nonce};
   const data={
    domain:{name:requirement.extra.name,version:requirement.extra.version,
     chainId:688689,verifyingContract:requirement.asset},
    types:{EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},
      {name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'}],
     TransferWithAuthorization:[{name:'from',type:'address'},{name:'to',type:'address'},
      {name:'value',type:'uint256'},{name:'validAfter',type:'uint256'},
      {name:'validBefore',type:'uint256'},{name:'nonce',type:'bytes32'}]},
    primaryType:'TransferWithAuthorization',message:authorization};
   status('Approve the test USDC EIP-712 authorization in your wallet…');
   const signature=await window.ethereum.request({
    method:'eth_signTypedData_v4',params:[account,JSON.stringify(data)]});
   const signed={x402Version:2,resource:offer.decoded.resource,accepted:requirement,
    payload:{signature,authorization}};
   status('Authorization signed. Facilitator is verifying and submitting the actual testnet transfer…');
   const response=await fetch(path,{headers:{'PAYMENT-SIGNATURE':b64(signed)},cache:'no-store'});
   const body=await response.json();
   const receipt=response.headers.get('PAYMENT-RESPONSE');
   let settlement=null;try{if(receipt)settlement=unb64(receipt)}catch{}
   print({httpStatus:response.status,response:body,paymentResponse:settlement});
   if(response.status===200&&settlement?.success&&/^0x[0-9a-f]{64}$/i.test(settlement.transaction)){
    lastProof={atUtc:new Date().toISOString(),path,httpStatus:200,network:'eip155:688689',
     price:requirement.amount,transaction:settlement.transaction,payer:settlement.payer,
     explorer:'https://atlantic.pharosscan.xyz/tx/'+settlement.transaction,
     paymentResponse:settlement,returnedData:body.data};
    $('proof').textContent=JSON.stringify(lastProof,null,2);
    const a=document.createElement('a');a.href=lastProof.explorer;a.target='_blank';
    a.rel='noopener noreferrer';a.textContent='Open verified payment on Atlantic explorer ↗';
    $('linkBox').replaceChildren(a);
    status('SUCCESS: 402 → EIP-712 signature → confirmed settlement → HTTP 200 with PAYMENT-RESPONSE.');
   }else{status('Payment not settled or still pending (HTTP '+response.status+'). Do NOT automatically sign the same authorization again; inspect response.');}
  }catch(e){status('Payment flow stopped safely: '+String(e.message||e));}
 }
 $('previewA').onclick=()=>preview('/api/insights');
 $('previewB').onclick=()=>preview('/api/report');
 $('payA').onclick=()=>paid('/api/insights');
 $('payB').onclick=()=>paid('/api/report');
 $('health').onclick=async()=>{const r=await fetch('/health');const b=await r.json();
  print({httpStatus:r.status,response:b});status('GET /health returned HTTP '+r.status);};
 $('supported').onclick=async()=>{const r=await fetch('/supported');print({httpStatus:r.status,response:await r.json()});status('Facilitator /supported returned HTTP '+r.status);};
 $('copy').onclick=()=>{if(lastProof)navigator.clipboard.writeText(JSON.stringify(lastProof,null,2)).catch(()=>{});};
 settings();
})();
</script></body></html>`;
