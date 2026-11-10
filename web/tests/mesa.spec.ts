import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(__dirname,'../..');
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').split('\n').filter(line=>line&&!line.startsWith('#')).map(line=>line.split('=')));
const output=path.join(root,'docs/evidence/phase-03c-1/depois');
const button=(page:Page,name:string)=>page.getByRole('button',{name,exact:true});
const link=(page:Page,name:string)=>page.getByRole('navigation',{name:'Áreas da central'}).getByRole('link',{name,exact:true});
const status=(page:Page,name:string)=>page.getByRole('status').filter({hasText:new RegExp(`^${name}$`)});
const sip=(page:Page)=>page.evaluate(async()=>{
 const read=(window as Window&{floraSipDiagnostics?:()=>Promise<{session:string;events:{event:string;detail?:string}[]}>}).floraSipDiagnostics;
 return read?.();
});
const packets=(page:Page)=>page.evaluate(async()=>{
 const read=(window as Window&{floraMediaStats?:()=>Promise<{type:string;kind:string;packetsReceived?:number}[]>}).floraMediaStats;
 return (await read?.())?.find(item=>item.type==='inbound-rtp'&&item.kind==='audio')?.packetsReceived??0;
});
async function login(page:Page,number:string){
 await page.goto('/');
 await page.getByLabel('Ramal',{exact:true}).selectOption(number);
 await page.getByLabel('Token de acesso').fill(env['TOKEN_'+number]);
 await page.getByLabel('Senha SIP').fill(env['SIP_'+number+'_PASSWORD']);
 await button(page,'Conectar ramal').click();
 try{await expect(status(page,'Disponível')).toBeVisible({timeout:25000});}
 catch(error){
  const alerts=await page.getByRole('alert').allTextContents();
  const statuses=await page.getByRole('status').allTextContents();
  fs.writeFileSync(path.join(output,`registro-${number}.json`),JSON.stringify({statuses,alerts,trace:await sip(page).catch(()=>null)},null,2));
  throw error;
 }
}
async function shot(page:Page,name:string){
 await page.screenshot({path:path.join(output,name+'.png')});
}
async function dial(page:Page,number:string){
 await page.getByLabel('Ramal ou fila de destino').fill(number);
 await button(page,'Ligar').click();
}
async function hang(page:Page){
 await button(page,'Encerrar chamada').click();
 await expect(status(page,'Disponível')).toBeVisible();
}

test('Mesa de Operação preserves the SIP session, real media and permissions across navigation',async({browser})=>{
 fs.mkdirSync(output,{recursive:true});
 const contexts=await Promise.all([201,202,203].map(()=>browser.newContext({permissions:['microphone'],viewport:{width:1440,height:960}})));
 const [a,b,c]=await Promise.all(contexts.map(context=>context.newPage()));
 const widths:number[]=[];
 const registrations:string[]=[];
 a.on('websocket',socket=>{
  if(new URL(socket.url()).pathname==='/ws')socket.on('framesent',event=>{
   if(String(event.payload).startsWith('REGISTER '))registrations.push('REGISTER');
  });
 });
 try{
  await a.goto('/');
  await shot(a,'desconectado');
  await login(a,'201');await login(b,'202');await login(c,'203');
  await expect(link(a,'Administração')).toBeVisible();
  await expect(link(b,'Administração')).toHaveCount(0);
  await expect(link(b,'Supervisão')).toHaveCount(0);
  await expect(link(c,'Supervisão')).toBeVisible();
  await expect(link(c,'Administração')).toHaveCount(0);
  await b.evaluate(()=>location.hash='administracao');
  await expect(b.getByRole('heading',{name:'Atendimento',exact:true})).toBeVisible();
  await shot(a,'atendimento-desktop');
  for(const width of [1440,1280,768,390,375,320,720]){
   await a.setViewportSize({width,height:960});
   for(const area of ['Atendimento','Visão geral','Supervisão','Histórico','Administração']){
    await link(a,area).click();
    expect(await a.evaluate(()=>document.documentElement.scrollWidth),`${area} at ${width}px`).toBeLessThanOrEqual(width);
   }
   widths.push(width);
   if(width===390){await link(a,'Atendimento').click();await shot(a,'atendimento-mobile');}
  }
  await a.setViewportSize({width:1440,height:960});
  const zoom=await a.context().newCDPSession(a);
  await zoom.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});
  expect(await a.evaluate(()=>visualViewport?.scale)).toBe(2);
  await zoom.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});
  await zoom.detach();
  await link(a,'Histórico').click();
  const before=await sip(a);
  expect(before?.session).toBeTruthy();
  const registrationCount=registrations.length;
  expect(registrationCount).toBeGreaterThan(0);
  await dial(b,'201');
  const answer=button(a,'Atender');
  await expect(answer).toBeVisible({timeout:15000});
  await shot(a,'recebida-historico');
  const cdp=await a.context().newCDPSession(a);
  const ax=await cdp.send('Accessibility.getFullAXTree');
  expect(ax.nodes.some(node=>node.role?.value==='button'&&node.name?.value==='Atender')).toBe(true);
  await cdp.detach();
  await a.setViewportSize({width:390,height:844});
  await a.locator('#conteudo').evaluate(element=>element.scrollIntoView({block:'start'}));
  const jump=button(a,'Chamada recebida · abrir discador');
  await expect(jump).toBeVisible();
  await jump.press('Enter');
  await expect(answer).toBeFocused();
  expect((await answer.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await answer.evaluate(element=>getComputedStyle(element).outlineStyle)).toBe('solid');
  await shot(a,'recebida-mobile');
  await answer.press('Enter');
  await expect(status(a,'Em ligação')).toBeVisible({timeout:18000});
  await expect(status(b,'Em ligação')).toBeVisible({timeout:18000});
  await a.setViewportSize({width:1440,height:960});
  await expect.poll(()=>packets(a)).toBeGreaterThan(5);
  await expect.poll(()=>packets(b)).toBeGreaterThan(5);
  const beforeNavigation=[await packets(a),await packets(b)];
  const reference=await a.getByText(/^Ref\. SIP /).innerText();
  for(const area of ['Atendimento','Supervisão','Histórico','Atendimento']){
   await link(a,area).click();
   await expect(status(a,'Em ligação')).toBeVisible();
   await expect(a.getByText(reference,{exact:true})).toBeVisible();
  }
  await expect.poll(()=>packets(a)).toBeGreaterThan(beforeNavigation[0]);
  await expect.poll(()=>packets(b)).toBeGreaterThan(beforeNavigation[1]);
  const afterNavigation=[await packets(a),await packets(b)];
  const after=await sip(a);
  expect(after?.session).toBe(before?.session);
  const registrationCountAfterNavigation=registrations.length;
  expect(registrationCountAfterNavigation).toBe(registrationCount);
  expect(after?.events.some(item=>item.event==='answer_requested')).toBe(true);
  await shot(a,'ativa');
  await button(a,'Colocar em espera').click();
  await expect(button(a,'Retomar ligação')).toBeVisible();
  await shot(a,'espera');
  await button(a,'Retomar ligação').click();
  await expect(button(a,'Colocar em espera')).toBeVisible();
  await a.getByText('Transferência',{exact:true}).click();
  await a.getByLabel('Destino da transferência').selectOption('203');
  await shot(a,'transferencia-direta');
  await button(a,'Consultar ramal').click();
  await button(c,'Atender').click();
  await expect(button(a,'Confirmar transferência')).toBeEnabled();
  await expect(a.getByRole('heading',{name:'Chamada de consulta'})).toBeVisible();
  await expect(a.getByTestId('peer')).toHaveText('202');
  await shot(a,'consulta');
  await button(a,'Cancelar consulta').click();
  await expect(button(a,'Colocar em espera')).toBeVisible();
  await hang(a);
  await expect(status(b,'Disponível')).toBeVisible();
  await dial(b,'201');
  await expect(answer).toBeVisible();
  await hang(b);
  await expect(answer).toHaveCount(0);
  await expect(a.getByRole('alert').filter({hasText:'não está mais disponível'})).toBeVisible();
  const permissions=await a.context().newCDPSession(a);
  const {targetInfo}=await permissions.send('Target.getTargetInfo');
  await permissions.send('Browser.setPermission',{permission:{name:'microphone'},setting:'denied',origin:'http://localhost:13400',browserContextId:targetInfo.browserContextId});
  await dial(a,'202');
  await expect(a.getByRole('alert').filter({hasText:'Microfone bloqueado'})).toBeVisible();
  await shot(a,'microfone-negado');
  await permissions.detach();
  await button(a,'Sair').click();
  await expect(a.getByRole('heading',{name:'Conectar seu ramal'})).toBeVisible();
  fs.writeFileSync(path.join(output,'mesa.json'),JSON.stringify({
   result:'PASS',widths,areasPerWidth:5,zoomReflowEquivalent:720,visualScale:2,keyboard:'mobile return and answer',sameSipSession:true,
   registerFramesBeforeNavigation:registrationCount,registerFramesAfterNavigation:registrationCountAfterNavigation,registerFramesAtTestEnd:registrations.length,
   mediaPacketsBefore:beforeNavigation,mediaPacketsAfter:afterNavigation,roles:['admin','operator','supervisor'],mediaSource:'synthetic browser microphone',
  },null,2));
 }finally{await Promise.all(contexts.map(context=>context.close()));}
});
