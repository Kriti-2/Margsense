import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';

const CYCLE_DURATION = 8000; // ms between auto-cycle

export default function NoticesBanner() {
  const [notices, setNotices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [isListViewOpen, setIsListViewOpen] = useState(false);

  // Language & HUD
  const [lang, setLang] = useState('en'); // 'en' or 'hi'
  const [isCrazyMode, setIsCrazyMode] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // Interactive: expanded inline preview on hover
  const [isExpanded, setIsExpanded] = useState(false);

  // Progress bar for auto-cycle timer
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(null);
  const cycleTimerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  // ── Web Audio Synth ──
  const playSynthSound = useCallback((type) => {
    if (isMuted) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.07);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
        osc.start(); osc.stop(ctx.currentTime + 0.07);
      } else if (type === 'warning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(480, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(); osc.stop(ctx.currentTime + 0.22);
      } else if (type === 'popup') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.04);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(990, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      }
    } catch (e) { /* silent */ }
  }, [isMuted]);

  // ── LocalStorage init ──
  useEffect(() => {
    try {
      const s1 = localStorage.getItem('parksense_dismissed_notices');
      if (s1) setDismissedIds(JSON.parse(s1));
      const s2 = localStorage.getItem('parksense_crazy_mode');
      if (s2 !== null) setIsCrazyMode(JSON.parse(s2));
      const s3 = localStorage.getItem('parksense_mute_mode');
      if (s3 !== null) setIsMuted(JSON.parse(s3));
      const s4 = localStorage.getItem('parksense_lang');
      if (s4) setLang(s4);
    } catch (e) { console.error(e); }
  }, []);

  // ── Fetch notices ──
  const fetchNotices = useCallback(async () => {
    try {
      const { data } = await api.getNotices();
      if (data?.notices) setNotices(data.notices);
    } catch (err) { console.error('Failed to fetch notices:', err); }
  }, []);

  useEffect(() => {
    fetchNotices();
    const id = setInterval(fetchNotices, 60000);
    return () => clearInterval(id);
  }, [fetchNotices]);

  // ── Active notices ──
  const activeNotices = useMemo(
    () => notices.filter((n) => !dismissedIds.includes(n.id)),
    [notices, dismissedIds]
  );

  useEffect(() => {
    if (currentIndex >= activeNotices.length && activeNotices.length > 0) setCurrentIndex(0);
  }, [activeNotices.length, currentIndex]);

  // ── Auto-cycle with progress bar ──
  useEffect(() => {
    if (activeNotices.length <= 1 || isPaused || selectedNotice || isListViewOpen || isExpanded) {
      // Freeze progress
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      return;
    }

    setProgress(0);
    let start = performance.now();

    const animate = (now) => {
      const elapsed = now - start;
      const pct = Math.min((elapsed / CYCLE_DURATION) * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        progressRef.current = requestAnimationFrame(animate);
      }
    };
    progressRef.current = requestAnimationFrame(animate);

    cycleTimerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % activeNotices.length);
    }, CYCLE_DURATION);

    return () => {
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    };
  }, [activeNotices.length, isPaused, selectedNotice, isListViewOpen, isExpanded, currentIndex]);

  // ── Translation dictionary ──
  const translate = useCallback((notice) => {
    const en = { title: notice.title, message: notice.message };
    let hi = { title: 'महत्वपूर्ण सूचना', message: notice.message };

    if (notice.id === 'civic-bbmp-orr') {
      hi = {
        title: '🚧 ORR सड़क मरम्मत कार्य शुरू',
        message: 'सिल्क बोर्ड जंक्शन के पास आउटर रिंग रोड (ORR) पर बीबीएमपी द्वारा सड़क मरम्मत एवं उपयोगिता कार्य शुरू। कृपया देरी की उम्मीद रखें।',
      };
    } else if (notice.id === 'civic-smart-parking') {
      hi = {
        title: '🚗 इंदिरानगर IoT स्मार्ट पार्किंग लाइव',
        message: 'इंदिरानगर 100 फीट रोड पर नए IoT-सक्षम स्मार्ट पार्किंग स्लॉट अब लाइव हैं। ParkSense से स्लॉट बुक करें।',
      };
    } else if (notice.id === 'civic-metro-extension') {
      hi = {
        title: '🚌 मेट्रो फीडर बसों की आवृत्ति बढ़ी',
        message: 'भीड़ कम करने के लिए, BMRCL ने पीक आवर्स में इंदिरानगर मेट्रो स्टेशन से IT हब तक फीडर बसों की संख्या बढ़ाई है।',
      };
    } else if (notice.type === 'traffic' && notice.title.includes('Traffic Slowdown')) {
      const zone = notice.title.split(': ')[1] || 'ज़ोन';
      const m = notice.message.match(/(\d+(\.\d+)?%)/);
      const pct = m ? m[0] : 'काफ़ी';
      hi = {
        title: `🚨 ${zone} में भारी ट्रैफ़िक जाम`,
        message: `${zone} में अवैध पार्किंग के कारण वाहन गति सामान्य से ${pct} कम। कृपया वैकल्पिक मार्ग अपनाएँ।`,
      };
    }

    return { en, hi };
  }, []);

  // ── Handlers ──
  const goNext = (e) => { e?.stopPropagation(); playSynthSound('click'); setCurrentIndex((p) => (p + 1) % activeNotices.length); };
  const goPrev = (e) => { e?.stopPropagation(); playSynthSound('click'); setCurrentIndex((p) => (p === 0 ? activeNotices.length - 1 : p - 1)); };

  const dismiss = (e, id) => {
    e?.stopPropagation();
    playSynthSound('success');
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    localStorage.setItem('parksense_dismissed_notices', JSON.stringify(next));
  };

  const toggleLang = () => {
    playSynthSound('click');
    const next = lang === 'en' ? 'hi' : 'en';
    setLang(next);
    localStorage.setItem('parksense_lang', next);
  };

  const toggleHud = () => {
    const next = !isCrazyMode;
    setIsCrazyMode(next);
    playSynthSound('success');
    localStorage.setItem('parksense_crazy_mode', JSON.stringify(next));
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStorage.setItem('parksense_mute_mode', JSON.stringify(next));
    if (!next) {
      setTimeout(() => {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          const ctx = new AC(); const o = ctx.createOscillator(); const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination); o.type = 'sine';
          o.frequency.setValueAtTime(600, ctx.currentTime);
          g.gain.setValueAtTime(0.04, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
          o.start(); o.stop(ctx.currentTime + 0.1);
        } catch(e){}
      }, 50);
    }
  };

  const deepLink = (notice) => {
    playSynthSound('success');
    setSelectedNotice(null);
    setIsListViewOpen(false);
    if (notice.type === 'traffic') navigate('/congestion');
  };

  // ── Bail if nothing to show ──
  if (activeNotices.length === 0) return null;
  const cur = activeNotices[currentIndex];
  const tr = translate(cur);
  const t = tr[lang]; // current language text

  // ── Theme ──
  const getTheme = (n) => {
    const h = n.urgency === 'high';
    if (n.type === 'traffic') return {
      border: h ? 'border-red-500/50' : 'border-amber-500/40',
      bg: h ? 'bg-red-500/[0.06]' : 'bg-amber-500/[0.04]',
      accent: h ? 'border-l-red-500' : 'border-l-amber-500',
      badge: h ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-amber-500/15 text-amber-400 border-amber-500/25',
      glow: h ? 'text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.35)]' : 'text-amber-300',
      dot: h ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-amber-500 shadow-[0_0_10px_#f59e0b]',
      progressBar: h ? 'bg-red-500' : 'bg-amber-500',
    };
    if (n.type === 'circular') return {
      border: h ? 'border-purple-500/50' : 'border-indigo-500/40',
      bg: h ? 'bg-purple-500/[0.06]' : 'bg-indigo-500/[0.04]',
      accent: h ? 'border-l-purple-500' : 'border-l-indigo-500',
      badge: h ? 'bg-purple-500/15 text-purple-400 border-purple-500/25' : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
      glow: h ? 'text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.35)]' : 'text-indigo-300',
      dot: h ? 'bg-purple-500 shadow-[0_0_10px_#a855f7]' : 'bg-indigo-500 shadow-[0_0_10px_#6366f1]',
      progressBar: h ? 'bg-purple-500' : 'bg-indigo-500',
    };
    return {
      border: 'border-blue-500/40', bg: 'bg-blue-500/[0.04]',
      accent: 'border-l-blue-500',
      badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
      glow: 'text-blue-300', dot: 'bg-blue-500 shadow-[0_0_10px_#3b82f6]',
      progressBar: 'bg-blue-500',
    };
  };
  const th = getTheme(cur);

  return (
    <>
      <style>{`
        @keyframes scanline-slide { 0%{transform:translateY(-100%)} 100%{transform:translateY(100%)} }
        @keyframes holo-flicker { 0%,100%{opacity:.97} 50%{opacity:.88; filter:hue-rotate(3deg)} }
        @keyframes grid-breathe { 0%,100%{opacity:.05} 50%{opacity:.14} }
        .cyber-grid {
          background-size:20px 20px;
          background-image:linear-gradient(to right,rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.05) 1px,transparent 1px);
        }
        .scan-overlay::after {
          content:"";position:absolute;inset:0;pointer-events:none;z-index:10;
          background:linear-gradient(rgba(18,16,16,0) 50%,rgba(0,0,0,.2) 50%),linear-gradient(90deg,rgba(255,0,0,.04),rgba(0,255,0,.015),rgba(0,0,255,.04));
          background-size:100% 4px,8px 100%;
        }
        .lang-flip-enter { animation: langFlip .3s ease-out; }
        @keyframes langFlip {
          0% { opacity:0; transform:translateY(8px); }
          100% { opacity:1; transform:translateY(0); }
        }
        .expand-slide { animation: expandSlide .25s ease-out; }
        @keyframes expandSlide {
          0% { opacity:0; max-height:0; }
          100% { opacity:1; max-height:200px; }
        }
      `}</style>

      {/* ═══════ MAIN BANNER ═══════ */}
      <div
        className={`relative overflow-hidden transition-all duration-500 border-b border-command-border/30
          ${isCrazyMode ? 'scan-overlay bg-black/95 font-mono' : 'bg-gradient-to-r from-command-panel/90 to-command-panel backdrop-blur-lg'}
          ${th.border} ${th.bg} border-l-4 ${th.accent}`}
        style={isCrazyMode ? { animation: 'holo-flicker 10s infinite ease-in-out' } : {}}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => { setIsPaused(false); setIsExpanded(false); }}
      >
        {/* HUD grid overlay */}
        {isCrazyMode && <div className="absolute inset-0 cyber-grid pointer-events-none" style={{ animation:'grid-breathe 5s infinite' }} />}

        {/* Laser scanline */}
        {isCrazyMode && (
          <div className="absolute left-0 right-0 h-[2px] z-10 pointer-events-none opacity-40"
            style={{ animation:'scanline-slide 3.5s infinite linear', background:'linear-gradient(90deg,transparent,#3b82f6,transparent)', boxShadow:'0 0 12px #3b82f6' }} />
        )}

        {/* Corner brackets */}
        {isCrazyMode && <>
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-command-muted/40 z-20 pointer-events-none" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-command-muted/40 z-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-command-muted/40 z-20 pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-command-muted/40 z-20 pointer-events-none" />
        </>}

        {/* Auto-cycle progress bar at the very bottom */}
        {activeNotices.length > 1 && !isPaused && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5 z-30">
            <div className={`h-full ${th.progressBar} opacity-70 transition-none`} style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Content row */}
        <div className="relative z-20 mx-auto max-w-7xl flex items-center justify-between gap-5 px-6 md:px-8 py-5 sm:py-6">

          {/* Left: live dot + type badge + text */}
          <div className="flex-1 flex items-center gap-3 overflow-hidden cursor-pointer min-w-0"
            onClick={() => { playSynthSound('popup'); setSelectedNotice(cur); }}>

            {/* Pulsing radar dot */}
            <span className="relative flex h-3.5 w-3.5 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${th.dot}`} />
              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${th.dot}`} />
            </span>

            {/* Type badge */}
            <span className={`hidden sm:flex h-8 items-center rounded-lg px-3 border text-xs font-black uppercase tracking-widest select-none shrink-0 ${th.badge}`}>
              {cur.type}
            </span>

            {/* Notice text — single language with flip animation */}
            <div className="flex-1 min-w-0 overflow-hidden" key={`${cur.id}-${lang}`}>
              <div className="lang-flip-enter flex items-center gap-2.5 text-base sm:text-lg font-semibold tracking-tight">
                {isCrazyMode && (
                  <span className="text-command-accent text-xs font-black shrink-0 uppercase">
                    [{lang === 'en' ? 'EN' : 'HI'}]&gt;
                  </span>
                )}
                <span className="text-xs font-black uppercase tracking-widest text-command-muted shrink-0">
                  {cur.source}
                </span>
                <span className="text-gray-500 text-lg">|</span>
                <span className={`font-extrabold truncate ${th.glow}`}>{t.title}</span>
                <span className="hidden lg:inline text-gray-500">—</span>
                <span className="hidden lg:inline text-gray-300 truncate max-w-2xl font-normal text-sm">{t.message}</span>
              </div>
            </div>

            {/* Expand hint (visible on hover when paused) */}
            {isPaused && !isExpanded && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(true); playSynthSound('popup'); }}
                className="shrink-0 text-xs font-black text-command-accent uppercase tracking-wider hover:underline cursor-pointer animate-pulse hidden md:inline-block"
              >
                {isCrazyMode ? '[ EXPAND ]' : '▼ Expand'}
              </button>
            )}
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2.5 shrink-0">

            {/* Language toggle pill */}
            <button onClick={(e) => { e.stopPropagation(); toggleLang(); }}
              className="flex items-center h-9 rounded-full border border-command-border/50 bg-command-bg/40 overflow-hidden cursor-pointer transition-all hover:border-command-accent/40 group"
              title={lang === 'en' ? 'Switch to Hindi' : 'Switch to English'}>
              <span className={`px-3 py-1 text-xs font-black transition-all ${lang === 'en' ? 'bg-command-accent text-white' : 'text-gray-400 group-hover:text-white'}`}>EN</span>
              <span className={`px-3 py-1 text-xs font-black transition-all ${lang === 'hi' ? 'bg-command-accent text-white' : 'text-gray-400 group-hover:text-white'}`}>हि</span>
            </button>

            {/* Sound toggle */}
            <button onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className="p-2 rounded-xl border border-command-border/40 hover:bg-white/5 text-gray-400 hover:text-white transition-all cursor-pointer" title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-command-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>

            {/* HUD toggle */}
            <button onClick={(e) => { e.stopPropagation(); toggleHud(); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                isCrazyMode ? 'bg-green-500/15 border-green-500/40 text-green-400 hover:bg-green-500/25 shadow-[0_0_8px_rgba(34,197,94,0.15)]'
                  : 'border-command-border/60 text-gray-400 hover:text-white hover:bg-white/5'}`}
              title="Toggle HUD mode">
              {isCrazyMode ? '⚡ HUD' : '○ HUD'}
            </button>

            {/* Nav arrows */}
            {activeNotices.length > 1 && (
              <div className="flex items-center bg-command-bg/40 border border-command-border/40 rounded-xl p-1">
                <button onClick={goPrev} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs font-black text-gray-400 px-2 select-none font-mono">{currentIndex + 1}/{activeNotices.length}</span>
                <button onClick={goNext} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}

            {/* All notices button */}
            <button onClick={(e) => { e.stopPropagation(); playSynthSound('popup'); setIsListViewOpen(true); }}
              className="px-3.5 py-1.5 rounded-xl bg-command-accent/10 border border-command-accent/25 text-command-accent hover:bg-command-accent/20 text-xs font-black cursor-pointer uppercase tracking-wider">
              ALL ({activeNotices.length})
            </button>

            {/* Dismiss */}
            <button onClick={(e) => dismiss(e, cur.id)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer" title="Dismiss">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* ─── Interactive inline expand (shown on hover click) ─── */}
        {isExpanded && (
          <div className="expand-slide relative z-20 mx-auto max-w-7xl px-6 md:px-8 pb-4 pt-1">
            <div className={`rounded-xl border p-4 text-sm leading-relaxed
              ${isCrazyMode ? 'bg-black/80 border-command-accent/25 text-green-300 font-mono' : 'bg-command-bg/50 border-command-border/40 text-gray-200'}`}>
              {isCrazyMode && <div className="text-[9px] text-command-accent mb-1.5 uppercase font-bold tracking-widest select-none">&gt; DECRYPTED_FEED [{lang === 'en' ? 'ENGLISH' : 'HINDI'}] //</div>}
              <p className="text-xs sm:text-sm">{t.message}</p>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-command-border/30 text-[10px] text-command-muted">
                <span>{new Date(cur.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                <div className="flex gap-2">
                  {cur.type === 'traffic' && location.pathname !== '/congestion' && (
                    <button onClick={() => deepLink(cur)} className="text-command-accent font-bold hover:underline cursor-pointer">
                      {lang === 'en' ? '→ Avoid Congestion' : '→ भीड़ से बचें'}
                    </button>
                  )}
                  <button onClick={() => { playSynthSound('popup'); setSelectedNotice(cur); setIsExpanded(false); }} className="text-command-accent font-bold hover:underline cursor-pointer">
                    {lang === 'en' ? 'Full Details →' : 'पूर्ण विवरण →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════ DETAIL MODAL ═══════ */}
      {selectedNotice && (() => {
        const selTr = translate(selectedNotice);
        const selT = selTr[lang];
        const selTh = getTheme(selectedNotice);
        return (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className={`w-full max-w-xl rounded-2xl border p-6 sm:p-8 shadow-[0_0_60px_rgba(59,130,246,0.15)] relative overflow-hidden
              ${isCrazyMode ? 'border-command-accent/50 scan-overlay font-mono bg-black' : 'border-command-border bg-command-panel'}`}>

              {isCrazyMode && <>
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-command-accent" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-command-accent" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-command-accent" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-command-accent" />
              </>}

              <div className="flex items-start justify-between gap-4 mb-5 relative z-20">
                <div className="flex items-center gap-3">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-xl border ${selTh.badge}`}>
                    {selectedNotice.type === 'traffic' ? (
                      <svg className="h-6 w-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    ) : selectedNotice.type === 'circular' ? (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    ) : (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-widest text-command-muted">{selectedNotice.source}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase ${
                        selectedNotice.urgency === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                        {selectedNotice.urgency}
                      </span>
                      {/* Language toggle inside modal */}
                      <button onClick={toggleLang}
                        className="flex items-center h-5 rounded-full border border-command-border/50 bg-command-bg/40 overflow-hidden cursor-pointer hover:border-command-accent/40">
                        <span className={`px-1.5 text-[8px] font-black ${lang === 'en' ? 'bg-command-accent text-white' : 'text-gray-400'}`}>EN</span>
                        <span className={`px-1.5 text-[8px] font-black ${lang === 'hi' ? 'bg-command-accent text-white' : 'text-gray-400'}`}>हि</span>
                      </button>
                    </div>
                    <h3 className="text-lg font-extrabold text-white mt-1.5 uppercase tracking-tight">{selT.title}</h3>
                  </div>
                </div>
                <button onClick={() => { playSynthSound('click'); setSelectedNotice(null); }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-4 relative z-20">
                <div className={`rounded-xl border p-5 leading-relaxed
                  ${isCrazyMode ? 'bg-black/90 border-command-accent/25 text-green-300 font-mono shadow-[inset_0_0_10px_rgba(59,130,246,0.08)]' : 'bg-command-bg/40 border-command-border/40 text-gray-200'}`}>
                  {isCrazyMode && <div className="text-[9px] text-command-accent mb-2 uppercase font-bold tracking-widest select-none">&gt; FEED_DECRYPT [{lang === 'en' ? 'ENGLISH' : 'HINDI'}] //</div>}
                  <p className="whitespace-pre-line text-sm" key={`modal-${selectedNotice.id}-${lang}`}>
                    <span className="lang-flip-enter inline-block">{selT.message}</span>
                  </p>
                  {isCrazyMode && <div className="text-[9px] text-command-accent mt-3 uppercase font-bold tracking-widest select-none text-right">// END_FEED</div>}
                </div>

                <div className="flex items-center justify-between text-xs text-command-muted border-t border-command-border/30 pt-3">
                  <span>{new Date(selectedNotice.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}</span>
                  <span>{lang === 'en' ? 'Type' : 'प्रकार'}: <strong className="capitalize text-gray-300">{selectedNotice.type}</strong></span>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 relative z-20">
                <button onClick={(e) => { dismiss(e, selectedNotice.id); setSelectedNotice(null); }}
                  className="px-5 py-2.5 border border-command-border rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 cursor-pointer">
                  {lang === 'en' ? 'Dismiss Notice' : 'सूचना खारिज करें'}
                </button>
                {selectedNotice.type === 'traffic' && location.pathname !== '/congestion' && (
                  <button onClick={() => deepLink(selectedNotice)}
                    className="px-5 py-2.5 bg-command-accent rounded-xl text-xs font-black text-white hover:bg-command-accent/90 shadow-lg shadow-command-accent/20 hover:scale-[1.02] cursor-pointer transition-transform">
                    {lang === 'en' ? 'AVOID CONGESTION →' : 'भीड़ से बचें →'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════ LIST MODAL ═══════ */}
      {isListViewOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className={`w-full max-w-3xl rounded-2xl border p-6 sm:p-8 shadow-[0_0_60px_rgba(59,130,246,0.15)] flex flex-col max-h-[85vh] overflow-hidden
            ${isCrazyMode ? 'border-command-accent/50 scan-overlay font-mono bg-black' : 'border-command-border bg-command-panel'}`}>

            {isCrazyMode && <>
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-command-accent" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-command-accent" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-command-accent" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-command-accent" />
            </>}

            <div className="flex items-center justify-between mb-5 border-b border-command-border/40 pb-3 shrink-0 relative z-20">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  {lang === 'en' ? (isCrazyMode ? 'ACTIVE_SYSTEM_ALERTS' : 'All Active Notices') : (isCrazyMode ? 'सक्रिय_सिस्टम_अलर्ट' : 'सभी सक्रिय सूचनाएँ')}
                </h3>
                <p className="text-xs text-command-muted mt-0.5">
                  {lang === 'en' ? 'Live traffic updates and official government circulars.' : 'लाइव ट्रैफ़िक अपडेट और आधिकारिक सरकारी सूचनाएँ।'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleLang}
                  className="flex items-center h-6 rounded-full border border-command-border/50 bg-command-bg/40 overflow-hidden cursor-pointer hover:border-command-accent/40">
                  <span className={`px-2 text-[9px] font-black ${lang === 'en' ? 'bg-command-accent text-white' : 'text-gray-400'}`}>EN</span>
                  <span className={`px-2 text-[9px] font-black ${lang === 'hi' ? 'bg-command-accent text-white' : 'text-gray-400'}`}>हि</span>
                </button>
                <button onClick={() => { playSynthSound('click'); setIsListViewOpen(false); }}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 py-1 relative z-20">
              {activeNotices.map((n) => {
                const nTh = getTheme(n);
                const nTr = translate(n);
                const nT = nTr[lang];
                return (
                  <div key={n.id} className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 sm:p-5 rounded-xl border transition-all ${nTh.border} ${nTh.bg} border-l-4 ${nTh.accent}`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border mt-0.5 ${nTh.badge}`}>
                        {n.type === 'traffic' ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        )}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-wider text-command-muted">{n.source}</span>
                          <span className={`text-[8px] px-1.5 rounded border font-bold uppercase ${n.urgency === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>{n.urgency}</span>
                          <span className="text-[10px] text-command-muted">• {new Date(n.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <h4 className="text-sm font-extrabold text-white mt-1">{nT.title}</h4>
                        <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${isCrazyMode ? 'text-green-300/90' : 'text-gray-300'}`}>{nT.message}</p>
                      </div>
                    </div>
                    <div className="flex sm:flex-col justify-end gap-2 shrink-0 border-t sm:border-t-0 border-command-border/30 pt-2 sm:pt-0">
                      {n.type === 'traffic' && location.pathname !== '/congestion' && (
                        <button onClick={() => deepLink(n)} className="px-3 py-1.5 bg-command-accent/20 hover:bg-command-accent text-command-accent hover:text-white rounded-lg text-[10px] font-black cursor-pointer text-center transition-all">
                          {lang === 'en' ? 'View Map' : 'नक्शा'}
                        </button>
                      )}
                      <button onClick={(e) => dismiss(e, n.id)} className="px-3 py-1.5 border border-command-border rounded-lg text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer text-center">
                        {lang === 'en' ? 'Dismiss' : 'खारिज'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center mt-4 border-t border-command-border/40 pt-3 shrink-0 text-xs text-command-muted relative z-20">
              <span>{lang === 'en' ? 'Active notices' : 'सक्रिय सूचनाएँ'}: {activeNotices.length}</span>
              <button onClick={() => { playSynthSound('success'); localStorage.removeItem('parksense_dismissed_notices'); setDismissedIds([]); }}
                className="text-command-accent hover:underline cursor-pointer font-bold">
                {lang === 'en' ? 'Reset All Dismissed' : 'सभी खारिज रीसेट करें'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
