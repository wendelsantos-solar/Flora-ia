'use strict';
const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin='https://lab.flora.test';
const env=Object.fromEntries(fs.readFileSync('/run/flora/env','utf8').trim().split('\n').map(s=>s.split('=')));
const mode=process.argv[2]||'functional';
const resilienceModes=['backend-outage','db-outage','pbx-restart'];
const signalingOnly=mode==='functional-signaling'||resilienceModes.includes(mode);
const engine=mode.startsWith('firefox')?firefox:chromium;
const port=mode==='firefox-loopback'?3003:engine===firefox?3002:3001;
const browsers=new Map();
const results={mode,at:new Date().toISOString(),source:'synthetic native browser input; human voice not tested',result:'RUNNING',scenarios:{}};
const sessions=[];
const pages=[];
const tlsFailures=new WeakMap();
let lastStage='initialization';
function step(name){lastStage=name;console.log('STEP '+name);out();}
function out(){fs.writeFileSync('/evidence/'+mode+'.json',JSON.stringify(results,null,2)+'\n');}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,ms=15000){
 const end=Date.now()+ms;
 let last;
 do {try{last=await fn();if(last)return last;}catch(e){last=e.message;}await wait(350);}while(Date.now()<end);
 throw new Error('Timed out: '+lastStage+' ('+(typeof last==='string'?last.slice(0,180):String(last))+')');
}
async function client(index,number){
 let b=browsers.get(index);
 if(!b){
  b=await until(()=>engine.connect('ws://client'+index+':'+port+'/lab',{timeout:4000}),30000);
  browsers.set(index,b);
 }
 const context=await b.newContext(engine===firefox?{}:{permissions:['microphone']});
 sessions.push(context);
 const p=await context.newPage();
 pages.push(p);
 const tlsCodes=new Set();
 tlsFailures.set(p,tlsCodes);
 p.on('console',message=>{
  const code=message.text().match(/\b(?:ERR_CERT_[A-Z_]+|ERR_SSL_[A-Z_]+|SEC_ERROR_[A-Z_]+|SSL_ERROR_[A-Z_]+)\b/)?.[0];
  if(code&&tlsCodes.size<12)tlsCodes.add(code);
 });
 await p.addInitScript(()=>{
  const peers=[];
  window.labPCs=peers;
  window.RTCPeerConnection=new Proxy(window.RTCPeerConnection,{construct(target,args){const pc=Reflect.construct(target,args);peers.push(pc);return pc;}});
 });
 await p.goto(origin,{timeout:45000,waitUntil:'load'});
 await p.getByLabel('Ramal',{exact:true}).selectOption(number);
 await p.getByLabel('Token de acesso').fill(env['TOKEN_'+number]);
 await p.getByLabel('Senha SIP').fill(env['SIP_'+number+'_PASSWORD']);
 await p.getByRole('button',{name:'Conectar ramal',exact:true}).click();
 await ready(p);
 return p;
}
async function api(p,route,{method='GET',data,n,expected=200}={}){
 const headers={Origin:origin};
 if(n)headers.Authorization='Bearer '+env['TOKEN_'+n];
 const r=await p.request.fetch(origin+'/api/v1/'+route,{method,data,headers,timeout:5000});
 assert.equal(r.status(),expected,method+' '+route);
 return expected===200?await r.json():undefined;
}
const status=(p,re)=>p.getByRole('status').filter({hasText:re}).waitFor({timeout:20000});
const ready=p=>status(p,/^Disponível$/);
const active=p=>status(p,/^Em ligação$/);
const button=(p,name)=>p.getByRole('button',{name,exact:true});
const end=p=>button(p,'Encerrar chamada').click({timeout:6000});
const dial=async(p,d)=>{await p.getByLabel('Ramal ou fila de destino').fill(d);await button(p,'Ligar').click({timeout:8000});};
const answer=async p=>{await button(p,'Atender').click({timeout:12000});await active(p);};
const target=async(p,d)=>{await p.getByText('Transferência',{exact:true}).click();await p.getByLabel('Destino da transferência').selectOption(d);};
const rx=p=>p.evaluate(async()=>{
 const r=(await window.floraMediaStats?.()||[]).find(s=>s.type==='inbound-rtp'&&(s.kind==='audio'||s.mediaType==='audio'));
 return {packets:Number(r?.packetsReceived||0),energy:Number(r?.totalAudioEnergy||0),jitter:r?.jitter??null,lost:r?.packetsLost??null};
});
const diag=p=>p.evaluate(async()=>{
 const pc=window.labPCs?.at(-1);
 if(!pc)return null;
 const parse=desc=>(desc?.sdp||'').split(/\r?\n/).filter(l=>l.startsWith('a=candidate:')).map(l=>{
  const f=l.split(/\s+/),addr=f[4]||'';
  return {transport:f[2],type:f[7],addressClass:addr.endsWith('.local')?'mdns':(addr.startsWith('10.253.26.')||['10.252.26.8','10.252.26.9','10.252.26.10','10.252.26.24'].includes(addr))?'lab-wireguard':addr.startsWith('10.252.26.')?'lab-underlay':addr.startsWith('127.')||addr==='::1'?'loopback':addr.includes(':')?'ipv6':'ipv4'};
 });
 const entries=await pc.getStats().catch(()=>new Map());
 const pair=[...entries.values()].find(s=>s.type==='candidate-pair'&&(s.selected||s.nominated)&&s.state==='succeeded');
 return {ice:pc.iceConnectionState,connection:pc.connectionState,local:parse(pc.localDescription),remote:parse(pc.remoteDescription),capture:pc.getSenders().filter(s=>s.track?.kind==='audio').map(s=>s.track.readyState),codecs:[...entries.values()].filter(x=>x.type==='codec').map(x=>x.mimeType),selected:pair?{rtt:pair.currentRoundTripTime??null}:null};
});
async function media(a,b){
 const before=await Promise.all([rx(a),rx(b)]);
 const verified=await until(async()=>(await Promise.all([rx(a),rx(b)])).every((r,i)=>r.packets-before[i].packets>25&&r.energy-before[i].energy>.005),signalingOnly?3000:12000)
  .catch(error=>{if(!signalingOnly)throw error;return false;});
 return {verified,before,after:await Promise.all([rx(a),rx(b)]),ice:await Promise.all([diag(a),diag(b)])};
}
async function mark(p,n='201'){
 const x=await api(p,'calls?limit=100',{n});
 return new Set(x.items.map(r=>r.id));
}
async function history(p,prior,n='201',predicate=x=>!!x.ended_at){
 const item=await until(async()=>(await api(p,'calls?limit=100',{n})).items.find(x=>!prior.has(x.id)&&predicate(x)));
 const detail=await api(p,'calls/'+item.id,{n});
 return {call:detail.call,legs:detail.legs.map(x=>({channel:x.channel,ended_at:x.ended_at})),events:detail.events.map(x=>x.type),queue_events:detail.queue_events?.map(x=>x.kind)||[]};
}
async function queueFixture(a,b){
 await api(a,'queues/301',{method:'PUT',expected:202,data:{department:'recepcao',strategy:'rrmemory',ring_seconds:8,wait_seconds:30,fallback:''}});
 await api(a,'queues/301/members/202',{method:'PUT',expected:202});
 await presence(b,true,false);
 await queueState(a,'available');
}
const presence=(b,joined,paused)=>api(b,'queues/301/presence',{method:'PUT',expected:202,data:{joined,paused}});
const queueState=(a,state,n='201',ext='202')=>until(async()=>(await api(a,'operations',{n})).engine.queues['301']?.members[ext]?.state===state);
async function functional(){
 step('register three browser peers');
 const a=await client(1,'201');
 const b=await client(2,'202');
 const c=await client(3,'203');
 results.browser=browsers.get(1).version();
 let prior;
 if(mode!=='transfers'){
 await queueFixture(a,b);
 step('direct and hold');
 prior=await mark(a);
 await dial(c,'201');await answer(a);await active(c);
 const direct=await media(c,a);
 await button(a,'Colocar em espera').click();await button(a,'Retomar ligação').waitFor();
 await wait(800);const quiet=await rx(c);await wait(1100);
 const muted=await rx(c);if(direct.verified)assert(muted.energy-quiet.energy<.001);
 await button(a,'Retomar ligação').click();await button(a,'Colocar em espera').waitFor();
 const resumed=await media(c,a);
 await end(c);await Promise.all([ready(a),ready(c)]);
 results.scenarios.direct={direct,resumed,holdEnergy:muted.energy-quiet.energy,history:await history(a,prior)};
 if(mode==='direct-only')return;
 step('simultaneous queues and isolation');
 const d=await client(4,'211');
 const e=await client(4,'212');
 await presence(e,true,false);
 await queueState(d,'available','211','212');
 prior=await mark(a);const priorB=await mark(d,'211');
 await Promise.all([dial(a,'301'),dial(d,'301')]);
 await Promise.all([answer(b),answer(e)]);await Promise.all([active(a),active(d)]);
 const simultaneous=await Promise.all([media(a,b),media(d,e)]);
 await Promise.all([end(a),end(d)]);await Promise.all([ready(a),ready(b),ready(d),ready(e)]);
 const [histA,histB]=await Promise.all([history(a,prior),history(d,priorB,'211')]);
 assert.equal(histA.call.agent,'202');assert.equal(histB.call.agent,'212');
 await api(a,'calls/'+histB.call.id,{expected:404});await api(d,'calls/'+histA.call.id,{expected:404});
 const [extA,extB]=await Promise.all([api(a,'extensions'),api(d,'extensions')]);
 assert.deepEqual(extA.items.map(x=>x.number),['201','202','203']);assert.deepEqual(extB.items.map(x=>x.number),['211','212','213']);
 const stream=async(p,own,foreign)=>{
  const detail=await api(p,'calls/'+own);
  return p.evaluate(({own,foreign,after})=>new Promise((resolve,reject)=>{
   let ownCount=0,foreignCount=0;
   const ws=new WebSocket('wss://lab.flora.test/api/v1/events?after='+after);
   ws.onmessage=e=>{const row=JSON.parse(e.data);if(row.call_id===own)ownCount++;if(row.call_id===foreign)foreignCount++;};
   ws.onerror=()=>reject(new Error('WSS events unavailable'));
   setTimeout(()=>{ws.close();resolve({ownCount,foreignCount});},2300);
  }),{own,foreign,after:Math.min(...detail.events.map(x=>x.sequence))-1});
 };
 const events=await Promise.all([stream(a,histA.call.id,histB.call.id),stream(d,histB.call.id,histA.call.id)]);
 assert(events.every(x=>x.ownCount>0&&x.foreignCount===0));
 results.scenarios.queues={simultaneous,histA,histB,events,foreignDetail:404};
 step('pause and resume queue member');
 prior=await mark(a);await presence(b,true,true);await queueState(a,'paused');
 await dial(a,'301');await ready(a);assert.equal(await button(b,'Atender').count(),0);
 const pausedHistory=await history(a,prior);
 await presence(b,true,false);await queueState(a,'available');
 results.scenarios.pause={pausedHistory,member:'available after resume'};
 if(mode==='queues')return;
 }
 step('blind transfer');
 prior=await mark(a);
 await dial(c,'201');await answer(a);await active(c);await target(a,'202');
 await button(a,'Transferir direto').click();await answer(b);await ready(a);
 const blind=await media(c,b);await end(c);await Promise.all([ready(c),ready(b)]);
 results.scenarios.blind={media:blind,history:await history(a,prior,'201',x=>!!x.ended_at&&x.source==='203')};
 step('attended rejection and completion');
 prior=await mark(a);await dial(c,'201');await answer(a);await active(c);
 await target(a,'202');await button(a,'Consultar ramal').click();await button(b,'Rejeitar').click({timeout:12000});await ready(b);
 await button(a,'Colocar em espera').waitFor({timeout:12000});const rejected=await media(c,a);
 await button(a,'Consultar ramal').click();await answer(b);const consult=await media(a,b);
 await button(a,'Confirmar transferência').click();await ready(a);
 const transferred=await media(c,b);
 await end(c);await Promise.all([ready(c),ready(b)]);
 const attended=await history(a,prior,'201',x=>!!x.ended_at&&x.source==='203');
 assert(attended.events.includes('call.transfer.attended'));
 results.scenarios.attended={rejected,consult,transferred,history:attended};
 step('unavailable recipient');
 await b.context().close();
 await until(async()=>(await api(a,'extensions')).items.find(x=>x.number==='202')?.registered===false,30000);
 prior=await mark(a);await dial(c,'201');await answer(a);await active(c);await target(a,'202');
 await button(a,'Transferir direto').click();await Promise.all([ready(a),ready(c)]);
 results.scenarios.unavailable={history:await history(a,prior,'201',x=>!!x.ended_at&&x.source==='203')};
 step('abrupt disconnect during consultation');
 const b2=await client(2,'202');
 prior=await mark(a);await dial(c,'201');await answer(a);await active(c);await target(a,'202');
 await button(a,'Consultar ramal').click();await answer(b2);const beforeDisconnect=await media(a,b2);
 await c.context().close();await Promise.all([until(async()=>{await ready(a);return true;},75000),until(async()=>{await ready(b2);return true;},75000)]);
 results.scenarios.disconnect={beforeDisconnect,history:await history(a,prior,'201',x=>!!x.ended_at&&x.source==='203')};
 results.backend=await api(a,'telephony/status');
}
async function tenantQueue(){
 const secondary=mode==='queue-b';
 const originExtension=secondary?'211':'201';
 const agentExtension=secondary?'212':'202';
 step('register independent profiles for '+mode);
 const a=await client(secondary?4:1,originExtension);
 const b=await client(secondary?4:2,agentExtension);
 if(secondary){
  await presence(b,true,false);
  await queueState(a,'available',originExtension,agentExtension);
 }else await queueFixture(a,b);
 const prior=await mark(a,originExtension);
 step('call '+mode);
 await dial(a,'301');await answer(b);await active(a);
 const audio=await media(a,b);
 await end(a);await Promise.all([ready(a),ready(b)]);
 const record=await history(a,prior,originExtension);
 assert.equal(record.call.agent,agentExtension);
 results.scenarios.queue={audio,history:record};
}
async function resilience(){
 step('register peers before outage');
 const a=await client(1,'201');
 const b=await client(2,'202');
 const prior=await mark(a);
 const readiness=p=>p.evaluate(async()=>{try{return (await fetch('/api/health/ready',{signal:AbortSignal.timeout(3000)})).status;}catch{return 0;}});
 const socket=mode==='backend-outage'?a.evaluate(()=>new Promise(resolve=>{
  const ws=new WebSocket('wss://lab.flora.test/api/v1/events');
  ws.onclose=e=>resolve(e.code);
 })).catch(()=>null):null;
 console.log('OUTAGE_READY');
 if(mode==='pbx-restart'){
  await until(async()=>await readiness(a)===200,60000);
  await until(async()=>await fs.existsSync('/evidence/pbx-restored'),65000);
  await Promise.all([ready(a),ready(b)]);
 }else{
  await until(async()=>await readiness(a)!==200,45000);
  results.duringReadiness=await readiness(a);
 }
 step('place actual call '+mode);
 await dial(a,'202');await answer(b);await active(a);
 results.scenarios.direct=await media(a,b);
 await end(a);await Promise.all([ready(a),ready(b)]);
 console.log('CALL_FINISHED');
 await until(async()=>await readiness(a)===200,90000);
 const call=await history(a,prior,'201',x=>!!x.ended_at&&x.source==='201'&&x.destination==='202');
 const recent=(await api(a,'calls?limit=100',{n:'201'})).items.filter(x=>!prior.has(x.id)&&x.source==='201'&&x.destination==='202');
 assert.equal(recent.length,1);
 results.history=call;
 results.historyCount=recent.length;
 if(socket){
  results.socketClosed=await Promise.race([socket,wait(5000).then(()=>null)]);
  assert(results.socketClosed!==null,'operational WebSocket did not close during backend outage');
 }
}
async function compatibility(){
 step(engine.name()+' trusted registration and real media');
 const a=await client(1,'201');
 const b=await client(2,'202');results.registration='PASS';results.browser=browsers.get(1).version();
 const prior=await mark(a);
 await dial(a,'202');await answer(b);await active(a);
 results.initial=await Promise.all([diag(a),diag(b)]);
 try{results.scenarios.direct=await media(a,b);}
 finally{results.final=await Promise.all([diag(a),diag(b)]);results.rx=await Promise.all([rx(a),rx(b)]);if(await button(a,'Encerrar chamada').count())await end(a).catch(()=>{});results.history=await history(a,prior).catch(()=>null);}
}
async function signalingReconnect(){
 const p=await client(1,'201');
 const trace=()=>p.evaluate(()=>window.floraSipDiagnostics?.());
 const initial=await trace();
 assert(initial?.tenant&&initial?.session&&initial.engine?.connected);
 assert(initial.events.some(e=>e.event==='wss_connected')&&initial.events.some(e=>e.event==='sip_registered'));
 step('signaling registered; restart private edge');
 const recovered=await until(async()=>{
  const latest=await trace();
  if(latest?.events.some(e=>e.event==='wss_disconnected')&&
     latest.events.some(e=>e.event==='wss_reconnecting')&&
     latest.events.filter(e=>e.event==='sip_registered').length>=2)return latest;
  return false;
 },45000);
 assert.equal(recovered.session,initial.session);
 assert.equal(recovered.tenant,initial.tenant);
 results.scenarios.signaling={initial,recovered};
}
(async()=>{
 try{
  if(mode==='signaling-reconnect')await signalingReconnect();
  else if(mode.startsWith('firefox')||mode==='chromium-direct')await compatibility();
  else if(resilienceModes.includes(mode))await resilience();
  else if(mode==='queue-a'||mode==='queue-b')await tenantQueue();
  else await functional();
  results.result=signalingOnly?'PASS_SIGNALING_ONLY':'PASS';
 }catch(e){results.result='FAIL';results.stage=lastStage;results.diagnostics=await Promise.all(pages.map(async p=>({alert:(await p.getByRole('alert').allTextContents()).map(x=>x.slice(0,170)),status:(await p.getByRole('status').allTextContents()).slice(0,2),pc:await diag(p),rx:await rx(p)})).map(x=>x.catch(()=>null)));results.failure=String(e.message).split('\n').slice(0,5).join('\n');console.error(lastStage+': '+results.failure);process.exitCode=1;}
 finally{
  results.signaling=await Promise.all(pages.map(async p=>({
   tlsErrors:[...tlsFailures.get(p)],
   trace:p.isClosed()?null:await p.evaluate(()=>window.floraSipDiagnostics?.()).catch(()=>null)
  })));
  out();await Promise.all(sessions.map(x=>x.close().catch(()=>{})));await Promise.all([...browsers.values()].map(x=>x.close().catch(()=>{})));}
})();
