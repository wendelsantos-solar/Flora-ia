import {test,expect,Page} from '@playwright/test';
import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(__dirname,'../..');const output=process.env.BROWSER_EVIDENCE_DIR||path.join(root,'docs/evidence/phase-01-1');
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split('=')));
async function connect(p:Page,n:string){await p.goto('/');await p.getByLabel('Ramal',{exact:true}).selectOption(n);await p.getByLabel('Token de acesso').fill(env[`TOKEN_${n}`]);await p.getByLabel('Senha SIP').fill(env[`SIP_${n}_PASSWORD`]);await p.getByRole('button',{name:'Conectar ramal',exact:true}).click();await expect(p.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible({timeout:20000});}
async function stats(p:Page){return p.evaluate(async()=>{const read=(window as Window&{floraMediaStats?:()=>Promise<Record<string,unknown>[]>}).floraMediaStats;return read?await read():[];});}
const rx=(rows:Record<string,unknown>[])=>(rows||[]).find(row=>row.type==='inbound-rtp'&&row.kind==='audio')||{};
test('browser capabilities and trusted SIP registration; real generated audio in Firefox',async({browser,browserName},info)=>{
 const options={};const aContext=await browser.newContext(options);const bContext=await browser.newContext(options);const a=await aContext.newPage();const b=await bContext.newPage();const evidence:Record<string,unknown>={at:new Date().toISOString(),engine:browserName,version:browser.version(),human_audio:'PENDING',native_safari:'NOT TESTED — Playwright WebKit is not native Safari'};
 try{
 if(browserName==='firefox'){
  for(const p of [a,b])await p.addInitScript(()=>{
   const pcs:RTCPeerConnection[]=[];
   (window as Window&{iceProbe?:RTCPeerConnection[]}).iceProbe=pcs;
   window.RTCPeerConnection=new Proxy(window.RTCPeerConnection,{construct(target,args){const pc=Reflect.construct(target,args) as RTCPeerConnection;pcs.push(pc);return pc;}});
  });
 }
 await connect(a,'201');evidence.registration='PASS';evidence.capabilities=await a.evaluate(()=>({secureContext:isSecureContext,getUserMedia:typeof navigator.mediaDevices?.getUserMedia==='function',peerConnection:typeof RTCPeerConnection==='function',deviceChange:'ondevicechange' in navigator.mediaDevices,outputSelection:'setSinkId' in HTMLMediaElement.prototype}));
 if(browserName==='firefox'){
  await connect(b,'202');await a.getByRole('button',{name:'Ligar',exact:true}).click();await expect(b.getByRole('button',{name:'Atender',exact:true})).toBeVisible({timeout:15000});await b.getByRole('button',{name:'Atender',exact:true}).click();await expect(a.getByRole('status').filter({hasText:/^Em ligação$/})).toBeVisible({timeout:15000});evidence.initial=await Promise.all([a,b].map(async p=>({stats:await stats(p),state:await p.evaluate(()=>(window as Window&{floraMediaDiagnostics?:()=>unknown}).floraMediaDiagnostics?.())})));evidence.candidates=await Promise.all([a,b].map(p=>p.evaluate(()=>{
   const classify=(sdp:string|undefined)=>(sdp||'').split(/\r?\n/).filter(l=>l.startsWith('a=candidate:')).map(l=>{
    const f=l.split(/\s+/);const addr=f[4]||'';
    return {type:f[7],transport:f[2],addressClass:addr==='::1'||addr.startsWith('127.')?'loopback':addr.endsWith('.local')?'mdns':addr.includes(':')?'ipv6':'ipv4'};
   });
   return (window as Window&{iceProbe?:RTCPeerConnection[]}).iceProbe?.map(pc=>({local:classify(pc.localDescription?.sdp),remote:classify(pc.remoteDescription?.sdp)}));
  })));
  await expect.poll(async()=>Number(rx(await stats(a)).packetsReceived||0),{timeout:15000}).toBeGreaterThan(5);
  const before=await Promise.all([stats(a),stats(b)]);await a.waitForTimeout(2500);const after=await Promise.all([stats(a),stats(b)]);for(let i=0;i<2;i++){expect(Number(rx(after[i]).packetsReceived)-Number(rx(before[i]).packetsReceived||0)).toBeGreaterThan(20);expect(Number(rx(after[i]).totalAudioEnergy)-Number(rx(before[i]).totalAudioEnergy||0)).toBeGreaterThan(0.0001);}evidence.media={source:'Firefox native generated test input; no SIP/RTP mocks',before,after};await a.getByRole('button',{name:'Encerrar chamada',exact:true}).click();await expect(b.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible();evidence.media_result='PASS';
 }else{evidence.media_result='NOT EXECUTED — no physical microphone requested by automation';}
 evidence.result='PASS';
 }catch(error){evidence.result='FAIL';evidence.diagnostics=await Promise.all([a,b].map(async p=>({stats:await stats(p),state:await p.evaluate(()=>(window as Window&{floraMediaDiagnostics?:()=>unknown}).floraMediaDiagnostics?.())}))).catch(()=>[]);evidence.failure=String(error).split('\n').slice(0,4).join('\n');throw error;}
 finally{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,`${info.project.name}-compatibility.json`),JSON.stringify(evidence,null,2));for(const p of [a,b]){try{if(await p.getByRole('button',{name:'Encerrar chamada',exact:true}).isVisible())await p.getByRole('button',{name:'Encerrar chamada',exact:true}).click();}catch{}}await aContext.close();await bContext.close();}
});
