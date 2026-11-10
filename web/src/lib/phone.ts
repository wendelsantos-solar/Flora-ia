import { sipWssA, sipWssB } from './sip-transport';
import { Invitation, Inviter, Registerer, RegistererState, Session, SessionState, UserAgent } from 'sip.js';
import { defaultSessionDescriptionHandlerFactory, holdModifier, type SessionDescriptionHandler } from 'sip.js/lib/platform/web';
import { audioErrorMessage, observeMicrophone, type MicrophoneState } from './audio-health';

export type PhoneState = 'offline' | 'connecting' | 'reconnecting' | 'ready' | 'calling' | 'incoming' | 'answering' | 'connected' | 'ending';
export type CallControls = {held:boolean; changingHold:boolean; consultation: "idle"|"calling"|"connected"; transfer:"idle"|"pending"|"accepted"|"failed"|"unknown"};
const initialControls:CallControls={held:false,changingHold:false,consultation:"idle",transfer:"idle"};
export type AudioHealth = {
  sip: 'offline' | 'connecting' | 'reconnecting' | 'registered';
  media: 'idle' | 'connecting' | 'connected' | 'interrupted' | 'failed';
  microphone: MicrophoneState;
  playbackBlocked: boolean;
  levelsAvailable: boolean;
  inputLevel: number;
  outputLevel: number;
};
export const initialAudioHealth: AudioHealth = { sip: 'offline', media: 'idle', microphone: 'idle', playbackBlocked: false, levelsAvailable: false, inputLevel: 0, outputLevel: 0 };

export class Phone {
  private ua: UserAgent;
  private registerer: Registerer;
  private session?: Session;
  private consultation?: Inviter;
  private consultAudio?: HTMLAudioElement;
  private controls:CallControls={...initialControls};
  private ending=false;
  private transferTimeout?: ReturnType<typeof setTimeout>;
  private audio = new Audio();
  private disposed = false;
  private recovering = false;
  private registered = false;
  private readonly signalingSession = crypto.randomUUID();
  private readonly signalingTrace: Array<{at: string; event: string; code?: number; detail?: string; callId?: string}> = [];

  private async hashCallId(callId:string) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(callId));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async currentCallReference() {
    const session = this.session;
    if (!(session instanceof Invitation || session instanceof Inviter)) return;
    const reference = await this.hashCallId(session.request.callId);
    if (this.session === session) return reference;
  }

  async signalingDiagnostics() {
    const events = await Promise.all(this.signalingTrace.map(async ({callId, ...event}) => {
      if (!callId) return event;
      return {...event, callRef:await this.hashCallId(callId)};
    }));
    return {session: this.signalingSession, events};
  }

  private recordSignaling(event: string, code?: number, detail?: string, callId?: string) {
    this.signalingTrace.push({at: new Date().toISOString(), event, code, detail, callId});
    if (this.signalingTrace.length > 64) this.signalingTrace.shift();
  }

  recordRenderedState(state: PhoneState, eventsConnected: boolean, answerRendered: boolean) {
    this.recordSignaling('ui_state', undefined, [state, document.visibilityState, eventsConnected ? 'events_connected' : 'events_disconnected', answerRendered ? 'answer_rendered' : 'answer_absent'].join('/'));
  }
  private timer?: ReturnType<typeof setTimeout>;
  private mediaTimeout?: ReturnType<typeof setTimeout>;
  private endingTimeout?: ReturnType<typeof setTimeout>;
  private levelTimer?: ReturnType<typeof setInterval>;
  private context?: AudioContext;
  private monitors: Array<() => void> = [];
  private microphoneCleanup?: () => void;
  private levelCleanup?: () => void;
  private generation = 0;
  private microphone?: string;
  private switchingMicrophone = false;
  private muted = false;
  private health: AudioHealth = { ...initialAudioHealth };
  private lastInputReplacement: { previousEnded: boolean; replacementLive: boolean } | null = null;
  private lastRelease: { tracksEnded: boolean; connectionClosed: boolean } | null = null;

  constructor(
    number: string, password: string,
    private changed: (state: PhoneState, peer?: string) => void,
    private error: (message: string) => void,
    private healthChanged: (health: AudioHealth) => void = () => {},
    private controlsChanged: (controls: CallControls) => void = () => {},
  ) {
    this.audio.autoplay = true;
    this.audio.setAttribute('playsinline', '');
    const uri = UserAgent.makeURI(`sip:${number}@localhost`);
    if (!uri) throw new Error('Ramal inválido.');
    this.ua = new UserAgent({
      uri, authorizationUsername: number, authorizationPassword: password,
      transportOptions: { server: number.startsWith('21') ? sipWssB : sipWssA },
      logLevel: 'error', logConfiguration: false,
      sessionDescriptionHandlerFactoryOptions: { peerConnectionConfiguration: { iceServers: [] } },
      sessionDescriptionHandlerFactory: defaultSessionDescriptionHandlerFactory(async (constraints, handler) => {
        const session = this.consultation?.sessionDescriptionHandler===handler ? this.consultation : this.session; const generation = this.generation;
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (this.disposed || !session || (this.session !== session && this.consultation !== session) || generation !== this.generation || !handler.peerConnection) {
          stream.getTracks().forEach(track => track.stop());
          throw new Error('A chamada terminou antes de iniciar a captura de áudio.');
        }
        return stream;
      }),
      delegate: {
        onInvite: invitation => this.incoming(invitation),
        onConnect: () => this.recordSignaling('wss_connected'),
        onDisconnect: error => {
          if (this.disposed) return;
          const code = error?.message.match(/\(code: (\d{4})\)/)?.[1];
          this.recordSignaling('wss_disconnected', code ? Number(code) : undefined);
          this.registered = false;
          this.updateHealth({ sip: 'reconnecting' });
          if (!this.session) this.changed('reconnecting');
          this.error(this.session ? 'Sinalização SIP interrompida. Acompanhe o áudio; a central está tentando reconectar.' : 'Conexão SIP interrompida. Tentando reconectar…');
          this.recover();
        },
      },
    });
    this.registerer = new Registerer(this.ua, { expires: 120 });
    this.registerer.stateChange.addListener(state => {
      if (this.disposed) return;
      if (state === RegistererState.Registered) this.registrationAccepted();
      if (state === RegistererState.Unregistered) {
        this.registered = false;
        if (!this.recovering) this.updateHealth({ sip: 'offline' });
        if (!this.session && !this.recovering) this.changed('offline');
      }
    });
  }

  private updateHealth(patch: Partial<AudioHealth>) {
    this.health = { ...this.health, ...patch };
    if (!this.disposed) this.healthChanged({ ...this.health });
  }
  private constraints(device = this.microphone): MediaStreamConstraints {
    return { audio: { ...(device ? { deviceId: { exact: device } } : {}), echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false };
  }
  private registrationAccepted() {
    if (this.disposed) return;
    if (!this.registered) this.recordSignaling('sip_registered');
    this.registered = true;
    this.updateHealth({ sip: 'registered' });
    if (!this.session) this.changed('ready');
  }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection)
      throw new Error('WebRTC indisponível. Abra a central em localhost ou em uma origem HTTPS confiável.');
    this.recordSignaling('wss_connecting');
    this.changed('connecting');
    this.updateHealth({ sip: 'connecting' });
    try {
      await this.ua.start();
      await this.registerer.register({ requestDelegate: {
        onAccept: () => this.registrationAccepted(),
        onReject: response => { this.recordSignaling('sip_rejected', response.message.statusCode); this.registered = false; this.updateHealth({ sip: 'offline' }); this.changed('offline'); this.error('Registro SIP recusado. Confira o ramal e a senha SIP.'); },
      } });
    } catch (e) { this.recordSignaling('initial_connection_failed'); this.changed('offline'); this.updateHealth({ sip: 'offline' }); throw e; }
  }
  private recover() {
    if (this.recovering || this.disposed) return;
    this.recovering = true;
    this.timer = setTimeout(async () => {
      try {
        this.recordSignaling('wss_reconnecting');
        await this.ua.reconnect();
        if (this.disposed) return;
        await this.registerer.register({ requestDelegate: {
          onAccept: () => { this.registrationAccepted(); if (!this.session) this.error(''); },
          onReject: response => { this.recordSignaling('sip_rejected', response.message.statusCode); this.updateHealth({ sip: 'offline' }); if (!this.session) this.changed('offline'); this.error('Registro SIP recusado após reconexão. Conecte novamente.'); },
        } });
        this.recovering = false;
      } catch { this.recordSignaling('reconnect_failed'); this.recovering = false; this.recover(); }
    }, 3000);
  }
  private incoming(invitation: Invitation) {
    const callId = invitation.request.callId;
    this.recordSignaling('invite_received', undefined, invitation.state, callId);
    if (this.session || this.disposed || this.controls.transfer==='pending') {
      const reason = this.disposed ? 'disposed' : this.session ? 'existing_session' : 'transfer_pending';
      this.recordSignaling('invite_rejected_locally', 486, reason, callId);
      void invitation.reject({ statusCode: 486 }).catch(() => {});
      return;
    }
    invitation.stateChange.addListener(state => this.recordSignaling('invite_session_state', undefined, state, callId));
    invitation.delegate = {...invitation.delegate, onCancel:()=>{
      if (this.session === invitation && !this.ending) this.error('A chamada recebida não está mais disponível.');
    }};
    this.bind(invitation);
    this.recordSignaling('invite_bound', undefined, invitation.state, callId);
    this.changed('incoming', invitation.remoteIdentity.uri.user);
  }
  private bind(session: Session) {
    this.session = session;
    this.ending=false;
    this.updateControls({...initialControls});
    this.muted = false;
    const generation = ++this.generation;
    this.updateHealth({ media: 'connecting', microphone: 'idle', playbackBlocked: false });
    session.delegate = { ...session.delegate, onSessionDescriptionHandler: handler => this.watchMedia(session, handler as SessionDescriptionHandler) };
    session.stateChange.addListener(state => {
      if (this.disposed || generation !== this.generation || this.session !== session) return;
      if (state === SessionState.Established) {
        const handler = session.sessionDescriptionHandler as SessionDescriptionHandler | undefined;
        if (handler) this.attachAudio(handler);
        this.changed('connected', session.remoteIdentity.uri.user);
        if (handler) this.startLevels(handler);
      }
      if (state === SessionState.Terminated) this.release(session);
    });
  }
  private watchMedia(session: Session, handler: SessionDescriptionHandler) {
    const pc = handler.peerConnection;
    if (!pc) return;
    const connection = () => {
      if (this.session !== session || this.disposed) return;
      clearTimeout(this.mediaTimeout);
      if (pc.connectionState === 'connected') this.updateHealth({ media: 'connected' });
      else if (pc.connectionState === 'disconnected') {
        this.updateHealth({ media: 'interrupted' });
        this.mediaTimeout = setTimeout(() => {
          if (this.session === session && pc.connectionState === 'disconnected') this.failMedia(session);
        }, 15000);
      } else if (pc.connectionState === 'failed') this.failMedia(session);
    };
    pc.addEventListener('connectionstatechange', connection);
    this.monitors.push(() => pc.removeEventListener('connectionstatechange', connection));
    const added = (event: MediaStreamTrackEvent) => this.watchMicrophone(event.track);
    handler.localMediaStream.addEventListener('addtrack', added);
    this.monitors.push(() => handler.localMediaStream.removeEventListener('addtrack', added));
    handler.localMediaStream.getAudioTracks().forEach(track => this.watchMicrophone(track));
    connection();
  }
  private watchMicrophone(track: MediaStreamTrack) {
    if (track.kind !== 'audio') return;
    this.microphoneCleanup?.();
    this.microphoneCleanup = observeMicrophone(track,
      microphone => this.updateHealth({ microphone }),
      () => { this.updateHealth({ inputLevel: 0 }); this.error('Microfone desconectado ou permissão revogada. Escolha outro microfone em Dispositivo de áudio; a escuta pode continuar.'); },
    );
  }
  private failMedia(session: Session) {
    if (this.session !== session) return;
    this.updateHealth({ media: 'failed' });
    this.error('A conexão de áudio foi perdida. A chamada será encerrada; aguarde a conexão SIP e ligue novamente.');
    void this.endAndRelease(session);
  }
  private attachAudio(handler: SessionDescriptionHandler) {
    this.audio.srcObject = handler.remoteMediaStream;
    void this.resumeAudio();
  }
  async resumeAudio() {
    const session = this.session;
    if (!session || this.disposed) return;
    try { await this.audio.play(); await this.context?.resume(); if (this.session === session && !this.disposed) this.updateHealth({ playbackBlocked: false }); }
    catch { if (this.session === session && !this.disposed) { this.updateHealth({ playbackBlocked: true }); this.error('O navegador bloqueou a reprodução. Clique em Reproduzir áudio para escutar a chamada.'); } }
  }
  private startLevels(handler: SessionDescriptionHandler) {
    this.stopLevels();
    if (!window.AudioContext) return;
    try {
      const context = new AudioContext();
      this.context = context;
      const input = context.createAnalyser(); const output = context.createAnalyser();
      input.fftSize = output.fftSize = 256;
      const local = context.createMediaStreamSource(handler.localMediaStream);
      const remote = context.createMediaStreamSource(handler.remoteMediaStream);
      local.connect(input); remote.connect(output);
      const data = new Float32Array(256);
      const level = (node: AnalyserNode) => { node.getFloatTimeDomainData(data); return Math.min(1, Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length)); };
      void context.resume().catch(() => {});
      this.levelTimer = setInterval(() => this.updateHealth({ levelsAvailable: context.state === 'running', inputLevel: this.muted || this.health.microphone === 'unavailable' ? 0 : level(input), outputLevel: level(output) }), 200);
      this.levelCleanup = () => { local.disconnect(); remote.disconnect(); input.disconnect(); output.disconnect(); };
    } catch { this.stopLevels(); }
  }
  private stopLevels() {
    clearInterval(this.levelTimer);
    this.levelCleanup?.(); this.levelCleanup = undefined;
    if (this.context) void this.context.close().catch(() => {});
    this.context = undefined;
    this.updateHealth({ levelsAvailable: false, inputLevel: 0, outputLevel: 0 });
  }
  private release(session: Session) {
    if (this.session !== session) return;
    this.session = undefined;
    this.ending=false;
    if(this.controls.transfer!=='pending') {
      clearTimeout(this.transferTimeout);
      void this.endConsultation();
    }
    this.updateControls({held:false,changingHold:false,consultation:'idle'});
    this.audio.muted=false;
    clearTimeout(this.mediaTimeout); clearTimeout(this.endingTimeout);
    this.monitors.splice(0).forEach(cleanup => cleanup());
    this.microphoneCleanup?.(); this.microphoneCleanup = undefined;
    this.stopLevels();
    const handler = session.sessionDescriptionHandler as SessionDescriptionHandler | undefined;
    const pc = handler?.peerConnection;
    const tracks = [...(handler?.localMediaStream.getTracks() || []), ...(handler?.remoteMediaStream.getTracks() || [])];
    handler?.close();
    tracks.forEach(track => track.stop());
    this.audio.pause(); this.audio.srcObject = null;
    this.lastRelease = { tracksEnded: tracks.every(track => track.readyState === 'ended'), connectionClosed: !pc || pc.connectionState === 'closed' };
    this.muted = false;
    this.updateHealth({ media: 'idle', microphone: 'idle', playbackBlocked: false });
    if (!this.disposed) this.changed(this.registered ? 'ready' : this.recovering ? 'reconnecting' : 'offline');
  }
  async call(destination: string) {
    if (!/^(2[01][123]|3[0-9]{2})$/.test(destination)) throw new Error('Disque um ramal ou uma fila interna.');
    if (this.controls.transfer==='pending') throw new Error('Aguarde o resultado da transferência.');
    if (this.session) throw new Error('Encerre a chamada atual antes de discar.');
    if (!this.registered) throw new Error('Aguarde o registro SIP.');
    const session = new Inviter(this.ua, UserAgent.makeURI(`sip:${destination}@localhost`)!, { sessionDescriptionHandlerOptions: { constraints: this.constraints() } });
    this.bind(session); this.changed('calling', destination);
    try {
      await session.invite({ requestDelegate: { onReject: response => this.error(response.message.statusCode === 486 ? 'O outro ramal está ocupado.' : `Chamada recusada (${response.message.statusCode}). Confira se o outro ramal está disponível.`) } });
    } catch (e) {
      const wasCancelled = session.state === SessionState.Terminated || session.state === SessionState.Terminating;
      this.release(session); void session.dispose().catch(() => {});
      // getUserMedia errors may terminate the SIP session too; do not hide native permission failures.
      if (!wasCancelled || /NotAllowed|NotFound|NotReadable|Overconstrained|NotSupported/i.test(`${(e as Error).name} ${(e as Error).message}`)) throw new Error(audioErrorMessage(e));
    }
  }
  async answer() {
    const session = this.session;
    if (!(session instanceof Invitation) || session.state !== SessionState.Initial || this.ending) {
      this.recordSignaling('answer_unavailable');
      throw new Error('A chamada recebida não está mais disponível.');
    }
    this.recordSignaling('answer_requested', undefined, undefined, session.request.callId);
    this.changed('answering', session.remoteIdentity.uri.user);
    try { await session.accept({ sessionDescriptionHandlerOptions: { constraints: this.constraints() } }); }
    catch (e) { this.release(session); void session.dispose().catch(() => {}); throw new Error(audioErrorMessage(e)); }
  }
  async hangup() {
    const session = this.session;
    if (!session || session.state === SessionState.Terminating || this.ending) return;
    this.ending=true;
    this.changed('ending', session.remoteIdentity.uri.user);
    this.endingTimeout = setTimeout(() => { this.release(session); void session.dispose().catch(() => {}); }, 8000);
    try {
      if(this.consultation && this.controls.transfer!=='pending') await this.endConsultation();
      if(this.session!==session)return;
      if (session.state === SessionState.Established) await session.bye();
      else if (session instanceof Invitation) await session.reject();
      else if (session instanceof Inviter) await session.cancel();
    } catch (e) { this.release(session); void session.dispose().catch(() => {}); throw e; }
  }
  private async endAndRelease(session: Session) {
    try { await this.hangup(); } catch { /* The transport can already be gone. */ }
    finally { this.release(session); void session.dispose().catch(() => {}); }
  }
  private updateControls(patch:Partial<CallControls>) {
    this.controls={...this.controls,...patch};
    if(!this.disposed)this.controlsChanged({...this.controls});
  }
  private gatePrimaryAudio() {
    const handler=this.session?.sessionDescriptionHandler as SessionDescriptionHandler|undefined;
    const held=this.ending||this.controls.held||this.controls.changingHold;
    handler?.peerConnection?.getSenders().forEach(sender=>{
      if(sender.track?.kind==='audio')sender.track.enabled=!this.muted&&!held;
    });
    this.audio.muted=held;
    this.updateHealth({microphone:this.muted||held?'muted':handler?.localMediaStream.getAudioTracks().some(t=>t.readyState==='live')?'active':'unavailable',...(held?{inputLevel:0}:{})});
  }
  async setHold(held:boolean) {
    const session=this.session;
    if(session?.state!==SessionState.Established||this.ending||this.controls.changingHold||this.consultation||this.controls.transfer==='pending')throw new Error('Aguarde a operação atual da chamada.');
    if(held===this.controls.held)return;
    this.updateControls({changingHold:true});
    this.gatePrimaryAudio();
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try {
      await new Promise<void>((resolve,reject)=>{
        timeout=setTimeout(()=>{
          if(this.session===session)void this.endAndRelease(session);
          reject(new Error('A central não confirmou a espera. A ligação foi encerrada para proteger o áudio.'));
        },8000);
        void session.invite({sessionDescriptionHandlerModifiers:held?[holdModifier]:[],requestDelegate:{
          onAccept:()=>resolve(),onReject:()=>reject(new Error('A central recusou a alteração de espera.')),
        }}).catch(reject);
      });
      if(this.session!==session)return;
      this.updateControls({held});
    } finally {
      clearTimeout(timeout);
      if(this.session===session){this.updateControls({changingHold:false});this.gatePrimaryAudio();}
    }
  }
  async startConsultation(destination:string) {
    const original=this.session;
    if(!/^2[01][123]$/.test(destination)||destination===this.ua.configuration.uri.user||destination===original?.remoteIdentity.uri.user)
      throw new Error('Escolha outro ramal para a consulta.');
    if(original?.state!==SessionState.Established||this.ending||this.consultation||this.controls.transfer==='pending')throw new Error('A consulta exige uma chamada ativa.');
    await this.setHold(true);
    if(this.session!==original||original.state!==SessionState.Established||this.ending)return;
    const session=new Inviter(this.ua,UserAgent.makeURI(`sip:${destination}@localhost`)!,{sessionDescriptionHandlerOptions:{constraints:this.constraints()}});
    this.consultation=session;
    this.updateControls({consultation:'calling',transfer:'idle'});
    session.stateChange.addListener(state=>{
      if(this.consultation!==session)return;
      if(state===SessionState.Established){
        const handler=session.sessionDescriptionHandler as SessionDescriptionHandler;
        const audio=this.consultAudio=new Audio();
        audio.srcObject=handler.remoteMediaStream;
        if(this.audio.sinkId)void audio.setSinkId(this.audio.sinkId).catch(()=>this.error('A consulta usa a saída padrão do sistema.'));
        void audio.play().catch(()=>this.error('O navegador bloqueou o áudio da consulta.'));
        this.updateControls({consultation:'connected'});
      }
      if(state===SessionState.Terminated){
        this.releaseConsultation(session);
        if(this.controls.transfer!=='pending'&&this.session===original&&original.state===SessionState.Established)
          void this.setHold(false).catch(e=>this.error(audioErrorMessage(e)));
      }
    });
    try {
      await session.invite({requestDelegate:{onReject:()=>this.error('O ramal de consulta não atendeu ou recusou. Retornando à ligação original.')}});
    } catch(e) {
      this.releaseConsultation(session);
      void session.dispose().catch(()=>{});
      if(this.session===original)await this.setHold(false);
      throw e;
    }
  }
  private releaseConsultation(session:Inviter) {
    if(this.consultation!==session)return;
    this.consultation=undefined;
    this.consultAudio?.pause();
    if(this.consultAudio)this.consultAudio.srcObject=null;
    this.consultAudio=undefined;
    (session.sessionDescriptionHandler as SessionDescriptionHandler|undefined)?.close();
    this.updateControls({consultation:'idle'});
  }
  private async endConsultation() {
    const session=this.consultation;
    if(!session)return;
    this.releaseConsultation(session);
    try{
      if(session.state===SessionState.Established)await session.bye();
      else if(session.state===SessionState.Establishing)await session.cancel();
    }catch{/* Session can end concurrently. */}
    finally{void session.dispose().catch(()=>{});}
  }
  async cancelConsultation() {
    if(this.controls.transfer==='pending')throw new Error('A transferência já foi enviada à central.');
    await this.endConsultation();
    if(this.session?.state===SessionState.Established)await this.setHold(false);
  }
  async transfer(destination?:string) {
    const original=this.session;
    if(original?.state!==SessionState.Established||this.ending||this.controls.transfer==='pending'||this.controls.changingHold)
      throw new Error('A transferência exige uma chamada ativa e sem outro comando pendente.');
    if(destination&&this.consultation)throw new Error('Conclua ou cancele a consulta atual.');
    if(destination&&(!/^(2[01][123]|3[0-9]{2})$/.test(destination)||destination===this.ua.configuration.uri.user||destination===original.remoteIdentity.uri.user))
      throw new Error('Escolha outro destino interno.');
    const target=destination?UserAgent.makeURI(`sip:${destination}@localhost`):this.consultation;
    if(!target||(!destination&&this.consultation?.state!==SessionState.Established))throw new Error('Aguarde o atendimento do ramal consultado.');
    this.updateControls({transfer:'pending'});
    const settle=(result:CallControls['transfer'])=>{
      if(this.controls.transfer!=='pending')return;
      clearTimeout(this.transferTimeout);
      this.updateControls({transfer:result});
      if(!this.session)void this.endConsultation();
      if(result==='failed')this.error('O Asterisk não confirmou a transferência. Verifique a chamada antes de tentar novamente.');
      if(result==='unknown')this.error('Não recebemos a confirmação da transferência. Consulte o histórico antes de repetir.');
    };
    this.transferTimeout=setTimeout(()=>settle('unknown'),18000);
    try{
      await original.refer(target,{requestDelegate:{onReject:()=>settle('failed')},onNotify:notification=>{
        void notification.accept().catch(()=>{});
        const status=Number(/^SIP\/2\.0 (\d{3})/.exec(notification.request.body||'')?.[1]);
        if(status>=200)settle(status<300?'accepted':'failed');
      }});
    }catch(e){settle('failed');throw e;}
  }
  mute(muted: boolean) {
    const tracks = (this.session?.sessionDescriptionHandler as SessionDescriptionHandler | undefined)?.peerConnection?.getSenders().map(sender => sender.track).filter(track => track?.kind === 'audio' && track.readyState === 'live') || [];
    if (!tracks.length) throw new Error('Microfone indisponível. Escolha um dispositivo de áudio para continuar.');
    tracks.forEach(track => { if (track) track.enabled = !muted && !this.controls.held && !this.controls.changingHold; });
    this.muted = muted; this.updateHealth({ microphone: muted ? 'muted' : 'active', ...(muted ? { inputLevel: 0 } : {}) });
  }
  async setMicrophone(id: string) {
    const session = this.session;
    if (!session || session.state !== SessionState.Established) { this.microphone = id; return; }
    if (this.switchingMicrophone) throw new Error('Aguarde a troca do microfone.');
    this.switchingMicrophone = true;
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia(this.constraints(id));
      if (this.session !== session || this.disposed) throw new Error('A chamada terminou antes da troca do microfone.');
      const handler = session.sessionDescriptionHandler as SessionDescriptionHandler;
      const sender = handler.peerConnection?.getSenders().find(item => item.track?.kind === 'audio');
      const track = stream.getAudioTracks()[0];
      if (!sender || !track) throw new Error('Este navegador não permite trocar o microfone nesta chamada. Encerre e selecione o dispositivo antes de ligar.');
      track.enabled = !this.muted && !this.controls.held && !this.controls.changingHold;
      await sender.replaceTrack(track);
      if (this.session !== session || this.disposed) throw new Error('A chamada terminou durante a troca do microfone.');
      const previousTracks = handler.localMediaStream.getAudioTracks();
      previousTracks.forEach(old => { handler.localMediaStream.removeTrack(old); old.stop(); });
      this.lastInputReplacement = { previousEnded: previousTracks.every(old => old.readyState === 'ended'), replacementLive: track.readyState === 'live' };
      handler.localMediaStream.addTrack(track);
      // addTrack does not emit addtrack when called by application code.
      this.watchMicrophone(track);
      this.microphone = id;
      this.startLevels(handler);
      this.error('');
      stream = undefined; // Ownership transferred to the session's handler.
    } finally { stream?.getTracks().forEach(track => track.stop()); this.switchingMicrophone = false; }
  }
  supportsOutputSelection() { return typeof this.audio.setSinkId === 'function'; }
  async setSpeaker(id: string) {
    if (!this.supportsOutputSelection()) throw new Error('Este navegador usa a saída de áudio do sistema.');
    try { await this.audio.setSinkId(id); }
    catch { throw new Error('Não foi possível selecionar a saída de áudio. Confira a conexão e as permissões do dispositivo ou escolha Padrão do sistema.'); }
  }
  async mediaStats() {
    const pc = ((this.consultation?.state===SessionState.Established?this.consultation:this.session)?.sessionDescriptionHandler as SessionDescriptionHandler | undefined)?.peerConnection;
    if (!pc) return null;
    return [...(await pc.getStats()).values()].filter(item => ['inbound-rtp', 'outbound-rtp', 'remote-inbound-rtp', 'candidate-pair', 'codec'].includes(item.type));
  }
  mediaDiagnostics() {
    const handler = this.session?.sessionDescriptionHandler as SessionDescriptionHandler | undefined;
    const track = (value: MediaStreamTrack) => ({ id: value.id, enabled: value.enabled, readyState: value.readyState, muted: value.muted });
    return { session: this.session?.state || null, connectionState: handler?.peerConnection?.connectionState || null, iceConnectionState: handler?.peerConnection?.iceConnectionState || null, localTracks: handler?.localMediaStream.getAudioTracks().map(track) || [], remoteTracks: handler?.remoteMediaStream.getAudioTracks().map(track) || [], health: { ...this.health }, outputSelectionSupported: this.supportsOutputSelection(), outputRouted: !!this.audio.sinkId, lastRelease: this.lastRelease, lastInputReplacement: this.lastInputReplacement };
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true; clearTimeout(this.timer); clearTimeout(this.transferTimeout);
    await this.endConsultation();
    const session = this.session;
    try { if (session) await this.endAndRelease(session); }
    finally {
      if (session) this.release(session);
      this.audio.pause(); this.audio.srcObject = null; this.stopLevels();
      try { await this.registerer.unregister(); } catch { /* Connection can already be closed. */ }
      await this.ua.stop();
    }
  }
}
