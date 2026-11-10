import test from 'node:test';
import assert from 'node:assert/strict';
import {observeMicrophone,audioErrorMessage} from '../../web/src/lib/audio-health.ts';
// Unit-only track double; never used as evidence of real capture, playback or a call.
class UnitTrack extends EventTarget { readyState='live'; enabled=true; muted=false; }
test('reports ended microphone and removes listeners during teardown',()=>{
 const track=new UnitTrack();const states=[];let lost=0;
 const cleanup=observeMicrophone(track,state=>states.push(state),()=>lost++);
 track.muted=true;track.dispatchEvent(new Event('mute'));
 track.muted=false;track.dispatchEvent(new Event('unmute'));
 track.readyState='ended';track.dispatchEvent(new Event('ended'));
 assert.deepEqual(states,['active','muted','active','unavailable']);assert.equal(lost,1);
 cleanup();track.dispatchEvent(new Event('ended'));assert.equal(lost,1);
});
test('translates permission and unavailable-device failures without losing recovery instructions',()=>{
 assert.match(audioErrorMessage({name:'NotAllowedError'}),/Permita o acesso/);
 assert.match(audioErrorMessage({message:'getDescription failed - NotAllowedError: Permission denied'}),/Microfone bloqueado/);
 assert.match(audioErrorMessage({name:'OverconstrainedError'}),/escolha um microfone/);
 assert.match(audioErrorMessage({name:'NotReadableError'}),/outro aplicativo/);
 assert.match(audioErrorMessage({name:'NotSupportedError'}),/navegador compatível/);
});
