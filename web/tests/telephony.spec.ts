import {test,expect,Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve(__dirname,'../..');
const evidenceDir=process.env.EVIDENCE_DIR||path.join(root,'docs/evidence');fs.mkdirSync(evidenceDir,{recursive:true});
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').split('\n').filter(line=>line&&!line.startsWith('#')).map(line=>line.split('=')));
async function connect(page:Page,number:string){await page.goto('/');await page.getByLabel('Ramal',{exact:true}).selectOption(number);await page.getByLabel('Token de acesso').fill(env[`TOKEN_${number}`]);await page.getByLabel('Senha SIP').fill(env[`SIP_${number}_PASSWORD`]);await page.getByRole('button',{name:'Conectar ramal',exact:true}).click();await expect(page.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible({timeout:25000});}
async function stats(page:Page){return page.evaluate(async()=>{const read=(window as Window&{floraMediaStats?:()=>Promise<Record<string,unknown>[]>}).floraMediaStats;return read?await read():[];});}
function inbound(rows:Record<string,unknown>[]){return rows.find(row=>row.type==='inbound-rtp'&&row.kind==='audio');}
function outbound(rows:Record<string,unknown>[]){return rows.find(row=>row.type==='outbound-rtp'&&row.kind==='audio');}
test('real WebRTC calls, bidirectional decoded test audio, hangup, reverse direction, SIP reconnect',async({browser})=>{
 const contextA=await browser.newContext({permissions:['microphone']});const contextB=await browser.newContext({permissions:['microphone']});const a=await contextA.newPage();const b=await contextB.newPage();
 const signals:string[]=[];const browserErrors:string[]=[];for(const [label,page]of [['201',a],['202',b]] as const){page.on('pageerror',error=>browserErrors.push(error.message.slice(0,200)));page.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text().split('\n')[0].slice(0,160));});page.on('websocket',socket=>{if(new URL(socket.url()).pathname!=='/ws')return;socket.on('framesent',event=>signals.push(`${label} framesent ${event.payload.toString().split('\r\n')[0]}`));socket.on('framereceived',event=>signals.push(`${label} framereceived ${event.payload.toString().split('\r\n')[0]}`));});}
 const evidence:{[key:string]:unknown}={generated_at:new Date().toISOString(),method:'Actual SIP.js over trusted WSS + Asterisk PJSIP + DTLS-SRTP. Native Chromium generated test microphone; no SIP, API, or media-transport mocks. Packet/decoded energy deltas in both peers. Human speech/listening not tested.'};
 try{
 await connect(a,'201');await connect(b,'202');await expect(a.getByText('Eventos ao vivo',{exact:true})).toBeVisible({timeout:15000});
 for(const [name,caller,callee]of [['201-to-202',a,b],['202-to-201',b,a]] as const){
  const previous=(await (await caller.request.get('/api/v1/calls')).json()).items.map((c:{id:string})=>c.id);
  await caller.getByRole('button',{name:'Ligar',exact:true}).click();await expect(callee.getByRole('button',{name:'Atender',exact:true})).toBeVisible({timeout:20000});await callee.getByRole('button',{name:'Atender',exact:true}).click();
  await expect(caller.getByRole('status').filter({hasText:/^Em ligação$/})).toBeVisible({timeout:25000});await expect(callee.getByRole('status').filter({hasText:/^Em ligação$/})).toBeVisible();
  const before=await Promise.all([stats(caller),stats(callee)]);await caller.waitForTimeout(4500);const after=await Promise.all([stats(caller),stats(callee)]);
  evidence[name]={before,after};fs.writeFileSync(path.join(evidenceDir,'webrtc.json'),JSON.stringify(evidence,null,2));
  for(let index=0;index<2;index++){const rxBefore=inbound(before[index]);const rxAfter=inbound(after[index]);const txBefore=outbound(before[index]);const txAfter=outbound(after[index]);expect(Number(rxAfter?.packetsReceived)-Number(rxBefore?.packetsReceived||0),`peer ${index} inbound RTP`).toBeGreaterThan(50);expect(Number(txAfter?.packetsSent)-Number(txBefore?.packetsSent||0),`peer ${index} outbound RTP`).toBeGreaterThan(50);expect(Number(rxAfter?.totalAudioEnergy)-Number(rxBefore?.totalAudioEnergy||0),`peer ${index} decoded audio energy`).toBeGreaterThan(0.00001);}
  await caller.getByRole('button',{name:'Silenciar microfone',exact:true}).click();await expect(caller.getByRole('button',{name:'Reativar microfone',exact:true})).toHaveAttribute('aria-pressed','true');await caller.getByRole('button',{name:'Reativar microfone',exact:true}).click();
  if(name==='201-to-202'){await caller.screenshot({path:path.join(evidenceDir,'call-desktop.png'),fullPage:true});}
  await caller.getByRole('button',{name:'Encerrar chamada',exact:true}).click();await expect(caller.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible();await expect(callee.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible();
  await expect.poll(async()=>{const response=await caller.request.get('/api/v1/calls');const json=await response.json();return json.items.filter((c:{id:string;state:string})=>!previous.includes(c.id)&&c.state==='completed').length;},{timeout:12000}).toBe(1);
  const latest=(await (await caller.request.get('/api/v1/calls')).json()).items.find((c:{id:string})=>!previous.includes(c.id));const detail=await (await caller.request.get(`/api/v1/calls/${latest.id}`)).json();expect(detail.legs.length).toBeGreaterThanOrEqual(2);(evidence[name] as Record<string,unknown>).persisted=detail;
 }
 await a.getByRole('button',{name:'Ligar',exact:true}).click();await expect(b.getByRole('button',{name:'Rejeitar',exact:true})).toBeVisible();await b.getByRole('button',{name:'Rejeitar',exact:true}).click();await expect(a.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible();evidence.rejection='remote reject terminated caller';
 const registerCount=signals.filter(line=>line.startsWith('202 framesent REGISTER')).length;
 execFileSync('docker',['compose','restart','asterisk'],{cwd:root,stdio:'pipe',timeout:30000});
 await expect.poll(()=>signals.filter(line=>line.startsWith('202 framesent REGISTER')).length,{timeout:35000}).toBeGreaterThan(registerCount);
 await expect(b.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible({timeout:25000});
 await expect.poll(async()=>{const r=await a.request.get('/api/health/ready');return r.status();},{timeout:35000}).toBe(200);
 evidence.recovery='Asterisk restarted; new REGISTER observed on WSS and AMI/readiness recovered';
 // Stop the observer while a genuine SIP call runs. The motor and media remain independent.
 const previousRecovery=(await (await a.request.get('/api/v1/calls')).json()).items.map((c:{id:string})=>c.id);
 execFileSync('docker',['compose','stop','backend'],{cwd:root,stdio:'pipe',timeout:30000});
 try{
  await a.getByRole('button',{name:'Ligar',exact:true}).click();await expect(b.getByRole('button',{name:'Atender',exact:true})).toBeVisible({timeout:20000});await b.getByRole('button',{name:'Atender',exact:true}).click();await expect(a.getByRole('status').filter({hasText:/^Em ligação$/})).toBeVisible({timeout:25000});await a.waitForTimeout(1500);await a.getByRole('button',{name:'Encerrar chamada',exact:true}).click();await expect(b.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible();
 }finally{execFileSync('docker',['compose','start','backend'],{cwd:root,stdio:'pipe',timeout:30000});}
 await expect.poll(async()=>{const r=await a.request.get('/api/v1/calls');if(!r.ok())return 0;const json=await r.json();return json.items.filter((c:{id:string;state:string})=>!previousRecovery.includes(c.id)&&c.state==='completed').length;},{timeout:25000}).toBe(1);
 evidence.backend_recovery='Call established and ended while backend stopped; CEL replay recovered completed session after backend restart';
 const calls=await (await a.request.get('/api/v1/calls')).json();evidence.calls=calls;const other=await a.request.get('/api/v1/calls',{headers:{Authorization:`Bearer ${env.TOKEN_OTHER}`}});expect((await other.json()).items).toEqual([]);evidence.tenant_isolation='other tenant cannot list calls';
 await a.screenshot({path:path.join(evidenceDir,'history-desktop.png'),fullPage:true});await a.setViewportSize({width:390,height:844});await a.screenshot({path:path.join(evidenceDir,'history-mobile.png'),fullPage:true});expect(await a.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await a.getByRole('button',{name:'Sair',exact:true}).click();await expect(a.getByRole('heading',{name:'Conectar seu ramal'})).toBeVisible();await expect(a.getByRole('table')).toHaveCount(0);await a.waitForTimeout(500);await expect(a.getByRole('table')).toHaveCount(0);evidence.logout='history cleared after logout';await a.screenshot({path:path.join(evidenceDir,'logout-mobile.png'),fullPage:true});
 evidence.result='PASS';fs.writeFileSync(path.join(evidenceDir,'sip-signals.json'),JSON.stringify(signals,null,2));fs.writeFileSync(path.join(evidenceDir,'webrtc.json'),JSON.stringify(evidence,null,2));
 }finally{fs.writeFileSync(path.join(root,".local/sip-signals.json"),JSON.stringify(signals,null,2));fs.writeFileSync(path.join(root,".local/browser-errors.json"),JSON.stringify(browserErrors,null,2));await contextA.close();await contextB.close();}
});

test('REST authorization, input limits, tenant boundary, WebSocket origin and event isolation',async({request,browser})=>{
 expect((await request.get('/api/health/live')).status()).toBe(200);
 expect((await request.get('/api/v1/calls')).status()).toBe(401);
 const auth={Authorization:`Bearer ${env.TOKEN_201}`};const other={Authorization:`Bearer ${env.TOKEN_OTHER}`};
 expect((await request.get('/api/v1/calls?limit=101',{headers:auth})).status()).toBe(400);
 expect((await request.get('/api/v1/calls/invalid',{headers:auth})).status()).toBe(400);
 const extensions=await (await request.get('/api/v1/extensions',{headers:auth})).json();expect(extensions.items.map((item:{number:string})=>item.number)).toEqual(expect.arrayContaining(['201','202']));
 expect((await request.get(`/api/v1/extensions/${extensions.items[0].id}`,{headers:other})).status()).toBe(404);
 const calls=await (await request.get('/api/v1/calls',{headers:auth})).json();expect(calls.items.length).toBeGreaterThan(0);
 expect((await request.get(`/api/v1/calls/${calls.items[0].id}`,{headers:other})).status()).toBe(404);
 expect((await (await request.get('/api/v1/calls',{headers:other})).json()).items).toEqual([]);
 const raw=JSON.stringify({calls,extensions});for(const secret of [env.SIP_201_PASSWORD,env.SIP_202_PASSWORD,env.AMI_PASSWORD,env.TOKEN_201])expect(raw).not.toContain(secret);
 expect((await request.get('/api/v1/events',{headers:{...auth,Origin:'https://evil.example'}})).status()).toBe(403);
 expect((await request.get('/api/v1/events')).status()).toBe(401);
 expect((await request.post('/api/v1/session',{headers:{Origin:'https://evil.example'},data:{token:env.TOKEN_201}})).status()).toBe(403);
 const context=await browser.newContext();try{const page=await context.newPage();await page.goto('/');const response=await page.request.post('/api/v1/session',{headers:{Origin:'http://localhost:13400'},data:{token:env.TOKEN_OTHER}});expect(response.status()).toBe(204);
 const received=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{const ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/v1/events?after=0`);let count=0;ws.onmessage=()=>count++;ws.onerror=()=>reject(new Error('WebSocket failed'));ws.onopen=()=>setTimeout(()=>{ws.close();resolve(count);},1200);}));expect(received).toBe(0);
 }finally{await context.close();}
});
