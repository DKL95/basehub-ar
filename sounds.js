// Sonidos de estadio de la ventana AR, generados en vivo con WebAudio (no
// usan archivos de audio): órgano de beisbol, batazo, golpe de guante,
// tribuna y campanita de detección. Se pueden silenciar con el botón 🔇
// (la preferencia se guarda en el navegador).

const StadiumSounds = (() => {
  const MUTE_KEY = "basehub-sonido-silenciado";
  let ctx = null, master = null, noiseBuf = null, murmur = null;
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { /* sin almacenamiento */ }

  // El AudioContext se crea en el primer toque (los navegadores no dejan
  // reproducir audio antes de una interacción del usuario).
  function ready() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
      // 2 s de ruido blanco: base del batazo, el guante y la tribuna.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  const now = () => ctx.currentTime;
  const NOTE = { G4: 392, A4: 440, B4: 494, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, A5: 880, B5: 987.8, C6: 1046.5, D6: 1174.7 };

  function noise(when, dur, filterType, freq, q, vol, attack) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + (attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(master);
    src.start(when, Math.random() * 1.5);
    src.stop(when + dur + 0.05);
    return { src, gain: g };
  }

  function sine(when, freq, dur, vol, type, endFreq) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, when);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, when + dur);
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(master);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  // Nota de órgano tipo Hammond: fundamental + armónicos y un vibrato suave.
  function organNote(when, freq, dur, vol) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.015);
    g.gain.setValueAtTime(vol, when + Math.max(0.02, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    g.connect(master);
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = 6.2; lfoGain.gain.value = freq * 0.006;
    lfo.connect(lfoGain);
    [[1, 0.6], [2, 0.35], [3, 0.18], [4, 0.1], [0.5, 0.2]].forEach(([h, level]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = freq * h;
      lfoGain.connect(o.frequency);
      og.gain.value = level;
      o.connect(og).connect(g);
      o.start(when); o.stop(when + dur + 0.02);
    });
    lfo.start(when); lfo.stop(when + dur + 0.02);
  }

  function melody(notes, start, vol) {
    let t = start;
    notes.forEach(([n, d]) => {
      if (n) organNote(t, NOTE[n], d * 0.92, vol);
      t += d;
    });
    return t;
  }

  // Batazo: chasquido seco de madera + golpe grave.
  function batCrack(when) {
    noise(when, 0.07, "bandpass", 2600, 1.4, 0.9);
    noise(when, 0.12, "highpass", 5000, 0.7, 0.25);
    sine(when, 1250, 0.05, 0.35, "triangle", 700);
    sine(when, 180, 0.09, 0.4, "sine", 90);
  }

  // Bola cayendo en el guante: golpe sordo de cuero.
  function glovePop(when) {
    noise(when, 0.08, "lowpass", 900, 1, 0.7);
    sine(when, 160, 0.1, 0.5, "sine", 80);
  }

  // Tribuna: ruido filtrado en las frecuencias de la voz, con una envolvente
  // que sube, se sostiene y se apaga, y un temblor que imita a mucha gente.
  function crowd(when, dur, vol) {
    const parts = [noise(when, dur, "bandpass", 750, 0.7, vol, 0.35), noise(when, dur, "bandpass", 1700, 1.1, vol * 0.55, 0.35)];
    parts.forEach(({ gain }) => {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 3 + Math.random() * 4;
      lg.gain.value = vol * 0.25;
      lfo.connect(lg).connect(gain.gain);
      lfo.start(when); lfo.stop(when + dur);
    });
  }

  const SOUNDS = {
    // Toque genérico de botón.
    click() { sine(now(), 1500, 0.04, 0.2, "triangle", 900); },
    // Logo detectado: campanita de dos notas y un aplauso corto de la tribuna.
    detect() {
      const t = now();
      sine(t, NOTE.E5 * 2, 0.35, 0.18); sine(t + 0.1, NOTE.A5 * 2, 0.5, 0.15);
      crowd(t + 0.05, 1.4, 0.25);
    },
    // Info: acorde de órgano que sube mientras el modelo gira.
    info() { melody([["C5", 0.12], ["E5", 0.12], ["G5", 0.12], ["C6", 0.9]], now(), 0.15); },
    // Animar: tonada de órgano con ritmo de estadio, del largo del baile (3.2 s).
    dance() {
      melody([
        ["C5", 0.2], ["E5", 0.2], ["G5", 0.2], ["E5", 0.2], ["F5", 0.2], ["A5", 0.2], ["C6", 0.2], ["A5", 0.2],
        ["G5", 0.2], ["B5", 0.2], ["D6", 0.2], ["B5", 0.2], ["C6", 0.3], [null, 0.1], ["G5", 0.2], ["C6", 0.2],
      ], now(), 0.13);
    },
    // Celebrar: batazo, fanfarria "¡Charge!" del órgano y la tribuna gritando.
    party() {
      const t = now();
      batCrack(t);
      melody([["G4", 0.16], ["C5", 0.16], ["E5", 0.16], ["G5", 0.34], ["E5", 0.16], ["G5", 0.7]], t + 0.3, 0.15);
      crowd(t + 0.15, 3.2, 0.5);
    },
    hit() { batCrack(now()); },
    out() { glovePop(now()); },
    run() { const t = now(); crowd(t, 1.6, 0.4); sine(t, NOTE.G5, 0.15, 0.08, "square"); sine(t + 0.12, NOTE.C6, 0.25, 0.08, "square"); },
    homer() { const t = now(); batCrack(t); crowd(t + 0.1, 2.8, 0.6); melody([["C5", 0.12], ["E5", 0.12], ["G5", 0.12], ["C6", 0.5]], t + 0.4, 0.13); },
  };

  function play(name) {
    if (muted) return;
    try { if (ready()) SOUNDS[name](); } catch { /* sin audio */ }
  }

  // Murmullo de fondo continuo (marcador en vivo) hasta que se llame stopMurmur.
  function startMurmur() {
    if (muted || murmur) return;
    try {
      if (!ready()) return;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = 650; f.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now());
      g.gain.exponentialRampToValueAtTime(0.09, now() + 0.8);
      src.connect(f).connect(g).connect(master);
      src.start();
      murmur = { src, g };
    } catch { /* sin audio */ }
  }
  function stopMurmur() {
    if (!murmur) return;
    const { src, g } = murmur;
    murmur = null;
    g.gain.cancelScheduledValues(now());
    g.gain.setValueAtTime(g.gain.value, now());
    g.gain.exponentialRampToValueAtTime(0.0001, now() + 0.4);
    src.stop(now() + 0.45);
  }

  function setMuted(on) {
    muted = on;
    try { localStorage.setItem(MUTE_KEY, on ? "1" : "0"); } catch { /* sin almacenamiento */ }
    if (on) stopMurmur();
    if (master) master.gain.value = on ? 0 : 0.9;
  }

  return { play, startMurmur, stopMurmur, setMuted, isMuted: () => muted };
})();
