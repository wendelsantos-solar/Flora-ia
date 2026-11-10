'use strict';

const icons = {
 flower:'<path d="M12 21v-7M12 16C5 16 3 11 4 7c4 0 8 2 8 7 0-5 4-7 8-7 1 4-1 9-8 9ZM12 11c-3-3-3-6 0-9 3 3 3 6 0 9Z"/>',
 overview:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
 phone:'<path d="M5 3h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C10 20 4 14 3 5a2 2 0 0 1 2-2Z"/>',
 monitor:'<path d="M3 18h18M5 14l4-5 4 3 5-7"/>',
 history:'<path d="M3 12a9 9 0 1 1 3 7M3 6v6h6m3-5v5l3 2"/>',
 admin:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 13h18m-11 0v2h4v-2"/>',
 advanced:'<path d="M5 3v18M12 3v18M19 3v18M2 8h6m1 8h6m1-8h6"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const routes = {overview:'Visão geral',phone:'Atendimento',monitor:'Supervisão',history:'Histórico',admin:'Administração',advanced:'Configurações avançadas'};
const adminSections = {users:'Usuários e ramais',groups:'Departamentos e filas',hours:'Horários e encaminhamento',organization:'Organização'};
const advancedSections = {trunk:'Tronco SIP',policy:'Políticas de discagem'};
const agents = [['201','Lia Nunes','Disponível'],['202','Caio Melo','Em atendimento'],['203','Bia Reis','Pausada']];
const queues = [['301','Recepção','2 aguardando'],['302','Enfermagem','Sem espera'],['303','Coordenação','1 aguardando']];
const history = [['09:42','201 → 202','Atendida','Recepção'],['09:37','203 → 301','Não atendida','Recepção'],['09:28','202 → 203','Transferida','Coordenação'],['09:14','201 → 302','Atendida','Enfermagem']];
const state = {role:'admin',call:'ready',joined:true,paused:false,muted:false,audioOpen:false};
const el = id => document.getElementById(id);
const button = (name,action,kind='quiet') => `<button type="button" class="${kind}" data-action="${action}">${name}</button>`;
const badge = (name,kind='') => `<span class="label ${kind}">${name}</span>`;
const section = (title,body,description='') => `<section class="box"><header class="section-head"><div><h2>${title}</h2>${description?`<p>${description}</p>`:''}</div></header>${body}</section>`;
const rows = items => `<ul class="list">${items.map(([label,sub,end])=>`<li><div><strong>${label}</strong><small>${sub}</small></div>${end}</li>`).join('')}</ul>`;
const field = (id,label,content) => `<div class="field"><label for="${id}">${label}</label>${content}</div>`;
const select = (id,options) => `<select id="${id}">${options.map(x=>`<option>${x}</option>`).join('')}</select>`;
const input = (id,value='',type='text') => `<input id="${id}" type="${type}" value="${value}"${id==='blocked'?'':' required'}${type==='number'?' min="1"':''}${id==='queue-number'?' pattern="3[0-9]{2}" inputmode="numeric"':''}>`;
const heading = (title,body) => `<h1>${title}</h1><p class="lede">${body}</p>`;
const notice = (title,text) => `<div class="notice"><strong>${title}</strong><p>${text}</p></div>`;
const link = (label,path) => `<a class="quiet" href="#${path}">${label}${icon('arrow')}</a>`;
const announce = message => {el('announcement').textContent=message;};
const allowed = key => (key!=='advanced'&&key!=='admin'||state.role==='admin')&&(key!=='monitor'||state.role!=='operator');
const queueRows = () => rows(queues.map(([n,title,status])=>[`${title} · ${n}`,'Fila de atendimento',badge(status,status==='Sem espera'?'neutral':'warn')]));
const agentRows = () => rows(agents.map(([n,name,status])=>[name,`Ramal ${n}`,badge(status,status==='Pausada'?'warn':'')]));
const metrics = () => '<dl class="metrics"><div><dt>Em espera</dt><dd>3</dd></div><div><dt>Em conversa</dt><dd>1</dd></div><div><dt>Disponíveis</dt><dd>1</dd></div></dl>';
const table = (filter='Todas') => {
 const matches=history.map((row,index)=>({row,index})).filter(({row})=>filter==='Todas'||filter===row[2]);
 if(!matches.length)return '<p class="body">Nenhuma chamada corresponde aos filtros.</p>';
 return `<table><caption class="sr">Registros de chamadas simuladas</caption><thead><tr><th scope="col">Chamada</th><th scope="col">Resultado</th><th scope="col">Detalhe</th></tr></thead><tbody>${matches.map(({row:[time,route,status,queue],index})=>`<tr><th scope="row">${route}<small>${time} · ${queue}</small></th><td>${status}</td><td>${button('Ver detalhes',`history-${index}`)}</td></tr>`).join('')}</tbody></table>`;
};

function page(route,part){
 switch(route){
 case 'overview':
  return heading('Visão geral','Veja o que está acontecendo nas filas e retome sua operação sem sair do discador.')+
   (state.role==='operator'?'':section('Operação agora',metrics(),'Recorte de demonstração'))+
   section('Filas de atendimento',queueRows())+
   section('Acessos rápidos',`<div class="body actions">${link('Ir para atendimento','phone')}${link('Consultar histórico','history')}${state.role!=='operator'?link('Abrir supervisão','monitor'):''}</div>`);
 case 'phone':
  return heading('Atendimento','Acompanhe suas filas e mantenha a ligação acessível durante toda a navegação.')+
   section('Minha fila',rows([['Recepção · 301',state.joined?(state.paused?'Atendimento pausado':'Inscrito para receber chamadas'):'Fora da fila',`<div class="actions">${state.joined?button(state.paused?'Retomar fila':'Pausar fila','pause-queue'):''}${button(state.joined?'Sair da fila':'Entrar na fila','join-queue')}</div>`]]))+
   section('Cenários de demonstração',`<div class="body"><p class="hint">Use os botões para explorar o discador. Nenhuma ligação será originada.</p><div class="actions">${button('Simular chamada recebida','incoming','cta')}${button('Simular microfone negado','denied')}${button('Simular perda SIP','reconnect')}${button('Simular ramal desconectado','offline')}${button('Simular registro','registering')}</div></div>`);
 case 'monitor':
  return heading('Supervisão','Separe a situação das filas, a disponibilidade dos agentes e as chamadas em curso.')+
   section('Operação agora',metrics(),'Indicadores simulados')+
   section('Filas',queueRows())+section('Atendentes',agentRows())+
   section('Chamadas em andamento',rows([['202 → 203','Coordenação · 1 min e 12 s',badge('Em conversa')]]));
 case 'history':
  return heading('Histórico','Encontre chamadas e confira o percurso por filas, ramais e transferências.')+
   section('Registros de chamadas',`<div class="body">${field('history-filter','Resultado',select('history-filter',['Todas','Atendida','Não atendida','Transferida']))}</div><div id="history-results">${table()}</div>`);
 case 'admin':
  return heading(adminSections[part]||'Administração','Organize ramais, filas e regras da sua empresa.')+
   `<nav class="section-links" aria-label="Administração">${Object.entries(adminSections).map(([key,title])=>link(title,'admin/'+key)).join('')}</nav>`+adminPage(part);
 case 'advanced':
  return heading(advancedSections[part]||'Configurações avançadas','Controle o que pode sair da central e acompanhe decisões de bloqueio.')+
   `<nav class="section-links" aria-label="Configurações avançadas">${Object.entries(advancedSections).map(([key,title])=>link(title,'advanced/'+key)).join('')}</nav>`+advancedPage(part);
 default: return '';
 }
}

function form(title,fields,operation){
 return section(title,`<form class="body" data-operation="${operation}"><div class="fields">${fields}</div><button class="cta">Revisar alterações</button><p class="form-feedback hint" role="status"></p></form>`);
}
function adminPage(part){
 if(part==='users')return section('Ramais existentes',agentRows(),'Catálogo e disponibilidade')+
  notice('Provisionamento futuro','Criar ramais, redefinir credenciais e administrar usuários exigem capacidades que ainda não estão disponíveis nesta interface.');
 if(part==='groups')return section('Filas cadastradas',queueRows())+
  form('Departamento',field('department','Nome do departamento',input('department','Recepção'))+field('code','Código',input('code','recepcao')),'department')+
  form('Fila',field('queue-number','Número',input('queue-number','301'))+field('queue-dept','Departamento',select('queue-dept',['Recepção','Enfermagem']))+field('strategy','Distribuição',select('strategy',['Todos tocam','Circular com memória','Menos recentes']))+field('queue-time','Tempo máximo em segundos',input('queue-time','30','number')),'queue');
 if(part==='hours')return form('Horário e destino quando fechado',field('zone','Fuso horário',select('zone',['America/Sao_Paulo','America/Manaus']))+field('day','Dias da semana',select('day',['Segunda a sexta','Todos os dias']))+field('opens','Abre às',input('opens','08:00','time'))+field('closes','Fecha às',input('closes','18:00','time'))+field('fallback','Destino alternativo',select('fallback',['Ramal 203','Encerrar chamada'])),'hours');
 if(part==='organization')return section('Organização',`<div class="body">${notice('Configuração organizacional futura','A identidade fictícia ilustra onde ficariam nome, preferências e dados da organização. Editar esses dados depende de novo contrato.')}</div>`);
 return section('Áreas administrativas',rows(Object.entries(adminSections).map(([key,title])=>[title,key==='users'?'Catálogo atual. Provisionamento futuro.':'Configuração da organização',link('Abrir','admin/'+key)])));
}
function advancedPage(part){
 if(part==='trunk')return notice('Somente laboratório','Tronco real depende de aprovação do perímetro, prestadora e autorização.')+
  form('Tronco de laboratório',field('trunk-state','Estado',select('trunk-state',['Desabilitado','Habilitado no simulador']))+field('trunk-capacity','Chamadas simultâneas',input('trunk-capacity','1','number'))+field('did','DID simulado',input('did','8800000000'))+field('target','Destino de entrada',select('target',['Ramal 201','Ramal 202','Fila 301'])),'trunk');
 if(part==='policy')return form('Limites e destinos',field('destinations','Destinos permitidos',input('destinations','8800000001'))+field('blocked','Destinos bloqueados',input('blocked','8800000009'))+field('attempts','Limite de tentativas',input('attempts','5','number'))+field('line','Ramal autorizado',select('line',['201','202'])),'policy')+
  section('Decisões de discagem',rows([['8800000009','09:37 · destino fora da política',badge('Bloqueada','bad')],['8800000001','09:33 · limite simultâneo atingido',badge('Capacidade','warn')]]));
 return section('Configuração do laboratório',rows(Object.entries(advancedSections).map(([key,title])=>[title,'Somente administrador',link('Abrir','advanced/'+key)])));
}

const callNames={ready:'Ramal disponível',incoming:'Chamada recebida',dialing:'Estabelecendo chamada',active:'Em conversa',held:'Chamada em espera',transfer:'Preparar transferência',consult:'Consulta assistida',transferring:'Transferência em andamento',unavailable:'Destinatário indisponível',denied:'Microfone bloqueado',reconnect:'Reconectando SIP',offline:'Ramal desconectado',registering:'Registrando ramal',ending:'Encerrando chamada'};
function phone(){
 const current=state.call;
 const extension={admin:'201',operator:'202',supervisor:'203'}[state.role];
 const peer=extension==='202'?'201':'202';
 const identity=current==='consult'?'Ramal 203':['incoming','active'].includes(current)?'Ramal '+peer:null;
 const inCall=['active','held','transfer','consult','transferring','unavailable','ending'].includes(current);
 const register=['offline','registering','reconnect'].includes(current)?callNames[current]:'Registrado';
 const description={ready:'Disque um ramal ou fila interna.',incoming:'Ligação interna para o seu ramal',dialing:'Aguardando confirmação da sessão SIP.',active:'Sessão de demonstração em andamento',held:'Seu microfone está suspenso na ligação original.',transfer:'A ligação original permanece sob seu controle.',consult:'A chamada original está em espera.',transferring:'Aguardando a confirmação da central.',unavailable:'Você pode voltar à ligação original.',denied:'Permita o microfone nas configurações do navegador e tente novamente.',reconnect:'Aguarde o registro antes de ligar.',offline:'Conecte seu ramal para receber chamadas.',registering:'Aguardando resposta do motor SIP.',ending:'Aguardando o encerramento da sessão.'};
 const panels={
  ready:`${field('destination','Ramal ou fila',input('destination',peer,'tel'))}<div class="actions">${button('Ligar','dialing','cta')}</div>`,
  incoming:`<div class="actions">${button('Atender','active','cta')}${button('Rejeitar','ending','danger')}</div>`,
  dialing:`<div class="actions">${button('Simular conexão','active','cta')}${button('Cancelar chamada','ending','danger')}</div>`,
  active:`<div class="actions">${button(state.muted?'Reativar microfone':'Silenciar microfone','mute')}${button('Colocar em espera','held')}${button('Transferir','transfer')}${button('Encerrar','ending','danger')}</div>`,
  held:`<div class="actions">${button('Retomar ligação','active','cta')}${button('Encerrar','ending','danger')}</div>`,
  transfer:`${field('transfer-destination','Destino autorizado',select('transfer-destination',['Ramal 203','Fila 301']))}<div class="actions">${button('Consultar ramal','consult','cta')}${button('Transferir direto','transferring')}${button('Cancelar','active')}</div>`,
  consult:`<div class="actions">${button('Confirmar transferência','transferring','cta')}${button('Cancelar consulta','active')}${button('Simular rejeição','unavailable')}</div>`,
  transferring:`<div class="actions">${button('Simular confirmação','ready','cta')}${button('Simular falha','unavailable')}</div>`,
  unavailable:`<div class="actions">${button('Retomar ligação','active','cta')}</div>`,
  denied:`<div class="actions">${button('Simular permissão concedida','ready','cta')}</div>`,
  reconnect:`<div class="actions">${button('Simular novo registro','ready','cta')}</div>`,
  offline:`<div class="actions">${button('Conectar ramal','registering','cta')}</div>`,
  registering:`<div class="actions">${button('Simular registro aceito','ready','cta')}</div>`,
  ending:`<div class="actions">${button('Simular encerramento confirmado','ready','cta')}</div>`,
 };
 el('phone').className='phone';
 el('phone-jump').textContent=current==='incoming'?'Chamada recebida · abrir discador':'Ir ao discador';
 el('phone').innerHTML=`<section class="box"><header class="section-head"><h2 tabindex="-1">Discador</h2>${badge('Ramal '+extension,'neutral')}</header><div class="body">
 ${innerWidth<=680?'<p class="hint">No celular, atendimento em demonstração. Operação depende de homologação.</p>':''}
 <div class="phone-focus ${current==='incoming'?'incoming':''}" aria-live="polite">${identity?`<small>${callNames[current]}</small>`:''}<strong>${identity||callNames[current]}</strong><span class="timer">${description[current]}</span></div>
 ${panels[current]}<dl class="signals"><div><dt>SIP</dt><dd>${register}</dd></div><div><dt>Microfone</dt><dd>${current==='denied'?'Bloqueado':state.muted?'Silenciado':'Padrão'}</dd></div><div><dt>Mídia</dt><dd>${inCall?'Em demonstração':'Sem mídia'}</dd></div></dl></div>
 <details ${state.audioOpen?'open':''}><summary>Dispositivos de áudio</summary>${field('mic','Microfone',select('mic',['Padrão do sistema','Headset demonstrativo']))}${field('speaker','Saída',select('speaker',['Padrão do sistema','Headset demonstrativo']))}</details></section>`;
 el('phone').querySelector('details').addEventListener('toggle',event=>{state.audioOpen=event.target.open;});
}
function navigate(focus=false){
 const [key,part]=location.hash.slice(1).split('/');
 const route=Object.hasOwn(routes,key)&&allowed(key)?key:'overview';
 el('navigation').innerHTML=Object.entries(routes).filter(([name])=>allowed(name)).map(([name,label])=>`<a href="#${name}" ${name===route?'aria-current="page"':''}>${icon(name)}${label}</a>`).join('');
 el('breadcrumb').textContent='Central / '+routes[route];
 el('content').innerHTML=page(route,part);
 if(focus)el('content').focus({preventScroll:true});
}
function details(title,content){
 el('detail-content').innerHTML=`<h2 id="detail-title">${title}</h2><div class="body">${content}</div>`;
 el('detail').showModal();
}
el('brand-icon').innerHTML=icon('flower');
el('role').addEventListener('change',event=>{state.role=event.target.value;state.call='ready';state.muted=false;phone();navigate();announce('Perfil de demonstração atualizado.');});
window.addEventListener('hashchange',()=>{if(location.hash!=='#content')navigate(true);});
document.addEventListener('change',event=>{
 if(event.target.id==='history-filter')el('history-results').innerHTML=table(event.target.value);
 if(event.target.id==='transfer-destination'){const consult=el('phone').querySelector('[data-action="consult"]');consult.disabled=event.target.selectedIndex!==0;}
});
let pendingForm;
document.addEventListener('submit',event=>{
 const operation=event.target.dataset.operation;if(!operation)return;
 event.preventDefault();
 pendingForm=event.target;
 const advanced=operation==='trunk'||operation==='policy';
 details('Revisar alterações',`<p>${advanced?'A mudança simulada afeta a autorização de chamadas e pode bloquear a discagem.':'Revise os dados antes de salvar a configuração.'}</p><div class="actions">${button('Aplicar na demonstração','apply','cta')}${button('Voltar','close-detail')}</div>`);
});
document.addEventListener('click',event=>{
 const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
 if(action==='show-phone'){el('phone').querySelector('h2').focus();return;}
 if(action==='apply'||action==='close-detail'){el('detail').close();if(action==='apply'&&pendingForm)pendingForm.querySelector('.form-feedback').textContent='Confirmação simulada. Nenhum dado foi alterado.';pendingForm=undefined;return;}
 if(action.startsWith('history-')){const [time,route,status,queue]=history[Number(action.split('-')[1])];details('Detalhes da chamada',`<p><strong>${route}</strong></p><p>${time} · ${status} · ${queue}</p><p class="hint">Registro fictício para demonstrar o detalhamento.</p>`);return;}
 if(action==='join-queue'||action==='pause-queue'){if(action==='join-queue'){state.joined=!state.joined;state.paused=false;}else state.paused=!state.paused;navigate();announce('Presença da fila atualizada na demonstração.');return;}
 if(action==='mute'){state.muted=!state.muted;phone();el('phone').querySelector('[data-action="mute"]').focus();return;}
 if(callNames[action]){state.call=action;if(action==='ready')state.muted=false;phone();el('phone').querySelector('button')?.focus();announce(callNames[action]);}
});
const compact=matchMedia('(max-width: 680px)');
compact.addEventListener('change',()=>phone());
navigate();
phone();
new IntersectionObserver(([entry])=>{el('phone-jump').classList.toggle('phone-in-view',entry.intersectionRatio>.7);},{threshold:[.7]}).observe(el('phone'));
