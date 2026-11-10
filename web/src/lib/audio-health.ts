export type MicrophoneState = 'idle' | 'active' | 'muted' | 'unavailable';

// Observes the real track. Tests use an explicitly identified unit-only EventTarget double.
export function observeMicrophone(
  track: MediaStreamTrack,
  changed: (state: MicrophoneState) => void,
  lost: () => void,
): () => void {
  const update = () => {
    if (track.readyState === 'ended') { changed('unavailable'); lost(); }
    else changed(!track.enabled || track.muted ? 'muted' : 'active');
  };
  track.addEventListener('ended', update);
  track.addEventListener('mute', update);
  track.addEventListener('unmute', update);
  update();
  return () => {
    track.removeEventListener('ended', update);
    track.removeEventListener('mute', update);
    track.removeEventListener('unmute', update);
  };
}

export function audioErrorMessage(error: unknown): string {
  const e = error as { name?: string; message?: string } | undefined;
  const text = `${e?.name || ''} ${e?.message || ''}`;
  if (/NotAllowedError|Permission denied|permission dismissed/i.test(text))
    return 'Microfone bloqueado. Permita o acesso nas configurações deste site e tente ligar ou atender novamente.';
  if (/NotFoundError|OverconstrainedError/i.test(text))
    return 'Microfone selecionado indisponível. Conecte o dispositivo e escolha um microfone em Dispositivo de áudio.';
  if (/NotReadableError|AbortError/i.test(text))
    return 'Não foi possível abrir o microfone. Confira a conexão e se outro aplicativo está usando o dispositivo.';
  if (/NotSupportedError|Not supported/i.test(text))
    return 'O navegador não conseguiu iniciar o áudio. Confira o dispositivo e tente novamente em um navegador compatível.';
  return e?.message || 'Não foi possível completar a ação. Tente novamente.';
}
