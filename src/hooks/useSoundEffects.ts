import { useCallback, useRef } from 'react';

/**
 * Gera sons sintéticos via Web Audio API (sem arquivos externos).
 */
export function useSoundEffects() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  /** Som de tecla digitada — clique mecânico suave */
  const playTyping = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;

      // Ruído de clique curto
      const bufferSize = ctx.sampleRate * 0.04;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 8);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.18, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      // Filtro para deixar o som mais "clique de teclado"
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 3200;
      filter.Q.value = 0.8;

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(now);
    } catch (e) {
      // Silencia erros de contexto de áudio
    }
  }, [getCtx]);

  /** Som de clique em botão — tom curto e suave */
  const playClick = useCallback(() => {
    try {
      const ctx = getCtx();
      const now = ctx.currentTime;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, now);
      oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.07);

      gainNode.gain.setValueAtTime(0.22, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.1);
    } catch (e) {
      // Silencia erros de contexto de áudio
    }
  }, [getCtx]);

  return { playTyping, playClick };
}
