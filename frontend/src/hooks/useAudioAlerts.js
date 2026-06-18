import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'parksense_audio_prefs';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * Synthesise a short alert tone using the Web Audio API.
 * @param {AudioContext} ctx
 * @param {'critical'|'warning'|'info'} type
 * @param {number} volume 0‒1
 */
function synthesise(ctx, type, volume) {
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(volume * 0.6, ctx.currentTime);

  if (type === 'critical') {
    // Two urgent descending beeps
    [0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime + offset);
      osc.frequency.linearRampToValueAtTime(660, ctx.currentTime + offset + 0.12);
      osc.connect(gain);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.13);
    });
    gain.gain.setValueAtTime(volume * 0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  } else if (type === 'warning') {
    // Single mid-frequency pulse
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
  } else {
    // Soft info blip
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.08);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  }
}

export function useAudioAlerts() {
  const ctxRef = useRef(null);

  const prefs = loadPrefs();
  const [muted, setMuted] = useState(prefs.muted ?? false);
  const [volume, setVolume] = useState(prefs.volume ?? 0.7);
  const [alerts, setAlerts] = useState({
    critical: prefs.alerts?.critical ?? true,
    warning:  prefs.alerts?.warning  ?? true,
    info:     prefs.alerts?.info     ?? true,
  });

  // Persist whenever settings change
  useEffect(() => {
    savePrefs({ muted, volume, alerts });
  }, [muted, volume, alerts]);

  // Lazily create AudioContext on first interaction
  function ensureCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }

  const play = useCallback(
    (type) => {
      if (muted || !alerts[type]) return;
      try {
        const ctx = ensureCtx();
        synthesise(ctx, type, volume);
      } catch (e) {
        // Audio not available — silently ignore
      }
    },
    [muted, volume, alerts]
  );

  const test = useCallback(
    (type) => {
      try {
        const ctx = ensureCtx();
        synthesise(ctx, type, volume);
      } catch (e) {}
    },
    [volume]
  );

  function toggleMute() {
    setMuted((m) => !m);
  }

  function updateVolume(v) {
    setVolume(v);
  }

  function toggleAlert(type) {
    setAlerts((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  return { muted, volume, alerts, play, test, toggleMute, updateVolume, toggleAlert };
}
