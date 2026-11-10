import {test,expect,Page,APIRequestContext} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(__dirname,'../..');
const origin='http://localhost:13400';
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split('=')));
const output=path.join(root,'docs/evidence/phase-02-5');
const headers=(n:string)=>({Origin:origin,Authorization:`Bearer ${env['TOKEN_'+n]}`});
const evidence=(name:string,data:unknown)=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify({at:new Date().toISOString(),data},null,2));};
const docker=(...args:string[])=>execFileSync('docker',['compose',...args],{cwd:root,encoding:'utf8',timeout:25000,stdio:'pipe'});
const channels=(engine:string)=>Number(docker('exec','-T',engine,'asterisk','-rx','core show channels count').match(/(\d+) active channels/)?.[1]??-1);
const ready=(page:Page)=>expect(page.getByRole('status').filter({hasText:/^Disponível$/})).toBeVisible({timeout:25000});
const active=(page:Page)=>expect(page.getByRole('status').filter({hasText:/^Em ligação$/})).toBeVisible({timeout:15000});
const hang=(page:Page)=>page.getByRole('button',{name:'Encerrar chamada',exact:true}).click();
async function enter(page:Page,n:string){
 await page.goto('/');
 await page.getByLabel('Ramal',{exact:true}).selectOption(n);
 await page.getByLabel('Token de acesso').fill(env['TOKEN_'+n]);
 await page.getByLabel('Senha SIP').fill(env['SIP_'+n+'_PASSWORD']);
 await page.getByRole('button',{name:'Conectar ramal',exact:true}).click();
 await ready(page);
}
async function dial(page:Page,n:string){await page.getByLabel('Ramal ou fila de destino').fill(n);await page.getByRole('button',{name:'Ligar',exact:true}).click();}
async function answer(page:Page){const b=page.getByRole('button',{name:'Atender',exact:true});await expect(b).toBeVisible({timeout:15000});await b.click();await active(page);}
async function status(request:APIRequestContext,route:string,n:string){return request.get('/api/v1/'+route,{headers:headers(n)});}
async function json(request:APIRequestContext,route:string,n:string){
 const r=await status(request,route,n);expect(r.status(),route).toBe(200);return r.json();
}
const write=(request:APIRequestContext,method:string,route:string,n:string,data?:unknown)=>request.fetch('/api/v1/'+route,{method,data,headers:headers(n)});
const rx=(page:Page)=>page.evaluate(async()=>{
 const read=(window as Window&{floraMediaStats?:()=>Promise<Record<string,unknown>[]>}).floraMediaStats;
 const r=(await read?.()||[]).find(s=>s.type==='inbound-rtp'&&s.kind==='audio');
 return {packets:Number(r?.packetsReceived||0),energy:Number(r?.totalAudioEnergy||0)};
});
async function bidirectional(a:Page,b:Page){
 const before=await Promise.all([rx(a),rx(b)]);
 await expect.poll(async()=>(await Promise.all([rx(a),rx(b)])).every((r,i)=>r.packets-before[i].packets>25&&r.energy-before[i].energy>.005),{timeout:12000}).toBe(true);
 return {before,after:await Promise.all([rx(a),rx(b)])};
}

test('two real PBXs: parallel queue media, API and SIP isolation, scoped roles and events',async({browser,request})=>{
 const contexts=await Promise.all([1,2,3,4].map(()=>browser.newContext({permissions:['microphone']})));
 const [a,b,c,d]=await Promise.all(contexts.map(x=>x.newPage()));
 const streams:Record<string,{call_id:string|null;type:string}[]>={A:[],B:[]};
 for(const [label,page] of [['A',a],['B',c]] as const){
  page.on('websocket',ws=>{if(ws.url().includes('/api/v1/events'))ws.on('framereceived',frame=>{try{streams[label].push(JSON.parse(frame.payload.toString()));}catch{}});});
 }
 let poison:'invite'|'refer'|undefined;
 let sent=0;
 const wireStatuses:string[]=[];
 // Change only the destination of actual SIP requests. All responses and media come from Asterisk.
 await a.routeWebSocket('wss://localhost:18489/ws',route=>{
  const server=route.connectToServer();
  route.onMessage(msg=>{
   let payload=msg.toString();
   if(poison==='invite'&&/^INVITE sip:202@localhost/.test(payload)){
    payload=payload.replace(/^INVITE sip:202@localhost/,'INVITE sip:212@localhost').replace(/^(To:\s*<?sip:)202@localhost/im,(_match,prefix:string)=>prefix+'212@localhost');sent++;
   }else if(poison==='refer'&&/^REFER /.test(payload)){
    payload=payload.replace(/^(Refer-To:\s*<?sip:)203@localhost/im,(_match,prefix:string)=>prefix+'212@localhost');sent++;
   }
   server.send(payload);
  });
  server.onMessage(msg=>{
   const line=msg.toString().split('\r\n')[0];
   if(poison&&/^SIP\/2\.0 [3456]/.test(line))wireStatuses.push(line);
   route.send(msg);
  });
 });
 const priorA=new Set<string>((await json(request,'calls?limit=100','201')).items.map((x:{id:string})=>x.id));
 const priorB=new Set<string>((await json(request,'calls?limit=100','211')).items.map((x:{id:string})=>x.id));
 const joinedA=(await json(request,'operations','201')).catalog.members.find((m:{queue:string;extension:string})=>m.queue==='301'&&m.extension==='202');
 const joinedB=(await json(request,'operations','211')).catalog.members.find((m:{queue:string;extension:string})=>m.queue==='301'&&m.extension==='212');
 try{
  expect(channels('asterisk')).toBe(0);expect(channels('asterisk-b')).toBe(0);
  const extA=(await json(request,'extensions','201')).items;
  const extB=(await json(request,'extensions','211')).items;
  expect(extA.map((x:{number:string})=>x.number)).toEqual(['201','202','203']);
  expect(extB.map((x:{number:string})=>x.number)).toEqual(['211','212','213']);
  expect((await status(request,'extensions/'+extB[0].id,'201')).status()).toBe(404);
  expect((await status(request,'extensions/'+extA[0].id,'211')).status()).toBe(404);
  expect((await write(request,'PUT','queues/301/members/212','201')).status()).toBe(409);
  expect((await write(request,'PUT','queues/301/members/202','211')).status()).toBe(409);
  expect((await write(request,'PUT','queues/301/presence','212',{joined:true,paused:false,extension:'202'})).status()).toBe(400);
  expect((await write(request,'PUT','departments/operacao/supervisors/213','201')).status()).toBe(400);
  expect((await status(request,'metrics','212')).status()).toBe(403);
  expect((await json(request,'operations','213')).catalog.departments.map((x:{code:string})=>x.code)).toEqual(['recepcao']);
  expect((await write(request,'PUT','departments/operacao','213',{name:'Proibido'})).status()).toBe(403);
  expect((await write(request,'PUT','queues/301/presence','202',{joined:true,paused:false})).status()).toBe(202);
  expect((await write(request,'PUT','queues/301/presence','212',{joined:true,paused:false})).status()).toBe(202);
  await enter(a,'201');await enter(b,'202');await enter(c,'211');await enter(d,'212');
  await expect.poll(async()=>(await json(request,'operations','201')).engine.queues['301']?.members['202']?.state).toBe('available');
  await expect.poll(async()=>(await json(request,'operations','211')).engine.queues['301']?.members['212']?.state).toBe('available');
  poison='invite';await dial(a,'202');await ready(a);
  expect(sent).toBeGreaterThan(0);
  expect(wireStatuses.some(line=>/SIP\/2.0 (404|403|484)/.test(line))).toBe(true);
  expect(channels('asterisk-b')).toBe(0);
  await expect(d.getByRole('button',{name:'Atender',exact:true})).toHaveCount(0);
  poison=undefined;
  await Promise.all([dial(a,'301'),dial(c,'301')]);
  await Promise.all([answer(b),answer(d)]);await Promise.all([active(a),active(c)]);
  const media=await Promise.all([bidirectional(a,b),bidirectional(c,d)]);
  expect(channels('asterisk')).toBe(2);expect(channels('asterisk-b')).toBe(2);
  await a.getByText('Transferência',{exact:true}).click();
  await a.getByLabel('Destino da transferência').selectOption('203');
  poison='refer';const before=sent;
  await a.getByRole('button',{name:'Transferir direto'}).click();
  await expect.poll(()=>sent).toBeGreaterThan(before);
  await expect(a.getByText('Transferência recusada.',{exact:true})).toBeVisible();
  await active(c);await active(d);expect(channels('asterisk-b')).toBe(2);
  poison=undefined;
  await Promise.all([hang(a),hang(c)]);
  await Promise.all([ready(a),ready(b),ready(c),ready(d)]);
  await expect.poll(()=>[channels('asterisk'),channels('asterisk-b')]).toEqual([0,0]);
  const newCall=async(n:string,prior:Set<string>)=>(await json(request,'calls?limit=100',n)).items.find((x:{id:string;destination:string;state:string})=>!prior.has(x.id)&&x.destination==='301'&&x.state==='completed');
  await expect.poll(async()=>Boolean(await newCall('201',priorA))&&Boolean(await newCall('211',priorB))).toBe(true);
  const callA=await newCall('201',priorA),callB=await newCall('211',priorB);
  expect((await status(request,'calls/'+callB.id,'201')).status()).toBe(404);
  expect((await status(request,'calls/'+callA.id,'211')).status()).toBe(404);
  expect((await status(request,'recordings/'+callB.id,'201')).status()).toBe(404);
  expect((await write(request,'POST','calls/'+callB.id+'/hangup','201')).status()).toBe(404);
  expect((await status(request,'calls/'+callB.id,'212')).status()).toBe(200);
  expect((await status(request,'calls/'+callB.id,'213')).status()).toBe(200);
  await expect.poll(()=>streams.A.some(e=>e.call_id===callA.id)&&streams.B.some(e=>e.call_id===callB.id),{timeout:20000}).toBe(true);
  expect(streams.A.some(e=>e.call_id===callB.id)||streams.B.some(e=>e.call_id===callA.id)).toBe(false);
  const dept='teste-escopo-025';
  expect((await write(request,'PUT','departments/'+dept,'211',{name:'Departamento restrito de teste'})).status()).toBe(204);
  try{
   expect((await json(request,'operations','213')).catalog.departments.some((x:{code:string})=>x.code===dept)).toBe(false);
   expect((await write(request,'PUT',`departments/${dept}/supervisors/213`,'211')).status()).toBe(202);
   expect((await json(request,'operations','213')).catalog.departments.some((x:{code:string})=>x.code===dept)).toBe(true);
   expect((await write(request,'DELETE',`departments/${dept}/supervisors/213`,'211')).status()).toBe(202);
   expect((await json(request,'operations','213')).catalog.departments.some((x:{code:string})=>x.code===dept)).toBe(false);
  }finally{await write(request,'DELETE','departments/'+dept,'211');}
  evidence('multitenant',{result:'PASS',media,callA,callB,wireStatuses,modifiedRequests:sent,negative:{extensions:404,calls:404,foreignMember:409,operatorMetrics:403,unassignedDepartment:'denied before and after grant',crossTenantEvent:false},channels:[0,0]});
 }finally{
  await Promise.all(contexts.map(x=>x.close()));
  if(joinedA)await write(request,'PUT','queues/301/presence','202',{joined:joinedA.joined,paused:joinedA.paused});
  if(joinedB)await write(request,'PUT','queues/301/presence','212',{joined:joinedB.joined,paused:joinedB.paused});
 }
});

test('opaque session cookie revocation closes an existing authenticated event socket',async({browser})=>{
 const context=await browser.newContext();
 const page=await context.newPage();
 try{
  await page.goto('/');
  const login=await page.request.post('/api/v1/session',{headers:{Origin:origin},data:{token:env.TOKEN_201}});
  expect(login.status()).toBe(204);
  const saved=(await context.cookies()).find(c=>c.name==='flora_session');
  expect(saved?.value).not.toBe(env.TOKEN_201);
  expect(saved?.httpOnly).toBe(true);
  expect(saved?.sameSite).toBe('Strict');
  expect(saved?.value).toMatch(/^[0-9a-f-]{36}\.[0-9a-f]{64}$/);
  await page.evaluate(()=>new Promise<void>((resolve,reject)=>{
   const probe=new WebSocket('ws://localhost:13400/api/v1/events?after=9223372036854775807');
   const state={code:0};(window as Window&{floraRevocation?:typeof state}).floraRevocation=state;
   probe.onopen=()=>resolve();probe.onerror=()=>reject(new Error('event socket failed'));probe.onclose=e=>{state.code=e.code;};
  }));
  const deleted=await page.request.delete('/api/v1/session',{headers:{Origin:origin}});
  expect(deleted.status()).toBe(204);
  const replay=await page.request.get('/api/v1/me',{headers:{Cookie:`flora_session=${saved!.value}`}});
  expect(replay.status()).toBe(401);
  await expect.poll(()=>page.evaluate(()=>(window as Window&{floraRevocation?:{code:number}}).floraRevocation?.code),{timeout:10000}).toBe(1008);
  evidence('session-revocation',{result:'PASS',opaque:true,httpOnly:true,sameSite:'Strict',replay:401,socketClose:1008});
 }finally{await context.close();}
});

test('temporary PostgreSQL outage preserves real SIP and replays exactly one call on recovery',async({browser,request})=>{
 const [ca,cb]=await Promise.all([1,2].map(()=>browser.newContext({permissions:['microphone']})));
 const [a,b]=await Promise.all([ca.newPage(),cb.newPage()]);
 let stopped=false;
 try{
  expect(channels('asterisk')).toBe(0);expect(channels('asterisk-b')).toBe(0);
  await enter(a,'201');await enter(b,'203');
  await expect(a.getByText('Eventos ao vivo',{exact:true})).toBeVisible();
  const prior=new Set<string>((await json(request,'calls?limit=100','201')).items.map((c:{id:string})=>c.id));
  docker('stop','db');stopped=true;
  try{
   expect((await request.get('/api/health/ready')).status()).toBe(503);
   await expect(a.getByText('Eventos desconectados',{exact:true})).toBeVisible();
   await dial(a,'203');await answer(b);await active(a);
   const media=await bidirectional(a,b);
   await hang(a);await Promise.all([ready(a),ready(b)]);
   await expect.poll(()=>channels('asterisk')).toBe(0);
   docker('start','db');stopped=false;
   await expect.poll(async()=>(await request.get('/api/health/ready')).status(),{timeout:35000}).toBe(200);
   await expect(a.getByText('Eventos ao vivo',{exact:true})).toBeVisible({timeout:35000});
   const recovered=async()=>(await json(request,'calls?limit=100','201')).items.filter((x:{id:string;state:string;source:string;destination:string})=>!prior.has(x.id)&&x.state==='completed'&&x.source==='201'&&x.destination==='203');
   await expect.poll(async()=>(await recovered()).length,{timeout:20000}).toBe(1);
   const [call]=await recovered();
   expect((await status(request,'calls/'+call.id,'202')).status()).toBe(404);
   expect((await status(request,'calls/'+call.id,'211')).status()).toBe(404);
   const detail=await json(request,'calls/'+call.id,'201');
   expect(detail.legs.length).toBeGreaterThanOrEqual(2);
   expect(detail.legs.every((l:{ended_at:string|null})=>l.ended_at!==null)).toBe(true);
   await a.waitForTimeout(2500);
   expect((await recovered()).length).toBe(1);
   evidence('database-recovery',{result:'PASS',media,call,legs:detail.legs.length,uniqueAfterReplay:1,operatorNonparticipant:404,foreignTenant:404,socketReconnected:true,activeChannels:channels('asterisk')});
  }finally{if(stopped){docker('start','db');stopped=false;}}
 }finally{await Promise.all([ca.close(),cb.close()]);}
});

test('three extensions: a busy queue member is skipped until the existing call ends',async({browser,request})=>{
 const contexts=await Promise.all([1,2,3].map(()=>browser.newContext({permissions:['microphone']})));
 const [a,b,c]=await Promise.all(contexts.map(ctx=>ctx.newPage()));
 const config=(await json(request,'operations','201')).catalog.members.find((m:{queue:string;extension:string})=>m.queue==='301'&&m.extension==='202');
 try{
  expect(channels('asterisk')).toBe(0);
  expect((await write(request,'PUT','queues/301/presence','202',{joined:true,paused:false})).status()).toBe(202);
  await enter(a,'201');await enter(b,'202');await enter(c,'203');
  const queue=async()=>(await json(request,'operations','201')).engine.queues['301'];
  await expect.poll(async()=>(await queue())?.members['202']?.state).toBe('available');
  await dial(c,'202');await answer(b);await active(c);
  const first=await bidirectional(c,b);
  await expect.poll(async()=>(await queue())?.members['202']?.state).toBe('busy');
  await dial(a,'301');
  await expect.poll(async()=>(await queue())?.waiting).toBe(1);
  await active(b);await active(c);
  await expect(b.getByRole('button',{name:'Atender',exact:true})).toHaveCount(0);
  expect(channels('asterisk')).toBe(3);
  await hang(c);await ready(c);
  await answer(b);await active(a);
  const second=await bidirectional(a,b);
  await hang(a);await Promise.all([ready(a),ready(b)]);
  await expect.poll(()=>channels('asterisk')).toBe(0);
  evidence('busy-queue',{result:'PASS',first,second,concurrentChannels:3,queueWaitedUntilAvailable:true,activeChannels:0});
 }finally{
  await Promise.all(contexts.map(ctx=>ctx.close()));
  if(config)await write(request,'PUT','queues/301/presence','202',{joined:config.joined,paused:config.paused});
 }
});
