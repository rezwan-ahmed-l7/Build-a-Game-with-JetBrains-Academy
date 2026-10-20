// Procedural WebAudio. No asset files — every sound is generated from
// oscillators, noise and envelopes. Browser autoplay policy requires the
// AudioContext to be resumed by a user gesture, so the start-menu "Play"
// button calls `audio.resume()`.

import { load, save } from '../utils/persistence.js';

export function createAudio() {
  let ctx = null;
  let masterGain = null;
  let ambientGain = null;
  let ambientNodes = null;
  let shoreNodes = null;
  let shoreGain = null;
  let shoreTarget = 0;
  let shoreApplied = -1;
  let muted = load('muted', false);
  let volume = load('volume', 0.5);

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : volume;
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    ensureContext();
    if (ctx && ctx.state === 'suspended') {
      return ctx.resume().catch(() => {});
    }
    return Promise.resolve();
  }

  function setMuted(value) {
    muted = !!value;
    save('muted', muted);
    if (masterGain) masterGain.gain.value = muted ? 0 : volume;
  }

  function setVolume(value) {
    volume = Math.max(0, Math.min(1, value));
    save('volume', volume);
    if (masterGain && !muted) masterGain.gain.value = volume;
  }

  function isMuted() {
    return muted;
  }

  function getVolume() {
    return volume;
  }

  // Build a one-shot sound: oscillator + envelope, optionally mixed with
  // filtered noise. Returns a play() function.
  function build({ type = 'sine', freq = 440, freqEnd = null, dur = 0.15,
                   attack = 0.005, decay = 0.12, gain = 0.3,
                   noise = 0, filterFreq = 1200 }) {
    return function play() {
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd != null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
      }
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + attack + decay + 0.02);

      if (noise > 0) {
        const bufferSize = Math.floor(ctx.sampleRate * (attack + decay));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = filterFreq;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(noise, t0);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
        src.connect(filt).connect(ng).connect(masterGain);
        src.start(t0);
        src.stop(t0 + attack + decay + 0.02);
      }
    };
  }

  // Cached one-shots. Each is a function() -> play().
  const sfx = {
    attack: build({ type: 'sawtooth', freq: 880, freqEnd: 220, dur: 0.18,
                    attack: 0.005, decay: 0.18, gain: 0.18,
                    noise: 0.12, filterFreq: 2400 }),
    hit: build({ type: 'square', freq: 320, freqEnd: 80, dur: 0.18,
                 attack: 0.001, decay: 0.18, gain: 0.22,
                 noise: 0.18, filterFreq: 1400 }),
    hurt: build({ type: 'triangle', freq: 280, freqEnd: 110, dur: 0.32,
                  attack: 0.002, decay: 0.32, gain: 0.28 }),
    pickup: build({ type: 'sine', freq: 660, freqEnd: 1320, dur: 0.18,
                    attack: 0.001, decay: 0.18, gain: 0.22 }),
    powerUp: build({ type: 'triangle', freq: 440, freqEnd: 880, dur: 0.45,
                     attack: 0.005, decay: 0.45, gain: 0.20 }),
    levelUp: build({ type: 'sine', freq: 523, freqEnd: 1046, dur: 0.6,
                     attack: 0.005, decay: 0.6, gain: 0.25 }),
    death: build({ type: 'sawtooth', freq: 220, freqEnd: 40, dur: 0.9,
                   attack: 0.01, decay: 0.9, gain: 0.32,
                   noise: 0.12, filterFreq: 800 }),
    dash: build({ type: 'square', freq: 520, freqEnd: 1040, dur: 0.18,
                  attack: 0.002, decay: 0.18, gain: 0.18,
                  noise: 0.10, filterFreq: 3000 }),
    menuClick: build({ type: 'sine', freq: 880, freqEnd: 1320, dur: 0.08,
                       attack: 0.001, decay: 0.08, gain: 0.18 }),
    gameOver: build({ type: 'triangle', freq: 440, freqEnd: 60, dur: 1.2,
                      attack: 0.01, decay: 1.2, gain: 0.28 }),
    // Wing-buzz / bee drone on enemy spawn — short noisy bandpass sweep
    // that says "a flying thing just appeared" without being a long
    // sustained note (which would overlap with the ambient pad).
    enemySpawn: build({ type: 'sawtooth', freq: 180, freqEnd: 90, dur: 0.22,
                        attack: 0.005, decay: 0.22, gain: 0.16,
                        noise: 0.22, filterFreq: 600 }),
    // Soft, springy hop and landing sounds for the player frog.
    frogJump: build({ type: 'triangle', freq: 300, freqEnd: 520, dur: 0.12,
                      attack: 0.004, decay: 0.13, gain: 0.10 }),
    frogLand: build({ type: 'sine', freq: 150, freqEnd: 75, dur: 0.10,
                      attack: 0.002, decay: 0.11, gain: 0.12,
                      noise: 0.035, filterFreq: 500 }),
    // Two short descending croak pulses give the frog a recognizable "ribbit".
    frogCroakA: build({ type: 'square', freq: 430, freqEnd: 245, dur: 0.11,
                        attack: 0.008, decay: 0.12, gain: 0.055,
                        noise: 0.018, filterFreq: 850 }),
    frogCroakB: build({ type: 'square', freq: 320, freqEnd: 175, dur: 0.13,
                        attack: 0.006, decay: 0.14, gain: 0.05,
                        noise: 0.015, filterFreq: 700 })
  };

  function safePlay(snd) {
    // Mobile Safari/Chrome can suspend AudioContext after a gesture, app
    // switch, or screen lock. Resume on the next genuine game interaction
    // before scheduling one-shot effects so frog sounds are not silently lost.
    ensureContext();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      ctx.resume().then(() => {
        if (ctx && ctx.state === 'running') {
          try { snd(); } catch { /* ignore */ }
        }
      }).catch(() => {});
      return;
    }
    try { snd(); } catch { /* ignore */ }
  }

  // Energetic arcade music: punchier bass, bright chord pad, fast arpeggio
  // and a light synthesized kick pulse. All music still routes through the
  // shared master gain, so the existing Music ON/OFF control mutes everything.
  let arpTimer = null;
  function buildAmbientGraph() {
    if (!ctx || ambientNodes) return;
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.42;
    ambientGain.connect(masterGain);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1700;
    filter.Q.value = 0.6;
    filter.connect(ambientGain);

    // A simple 2-bar chord progression. Bass = root, pad = chord notes.
    // Frequencies in Hz (A2=110, then up by ratios).
    const rootHz = 110;        // A2
    const chord = [220, 277, 330, 415]; // A3, C#4, E4, G#4 — A major 7-ish
    ambientNodes = [];

    // Bass: low sawtooth at root
    const bass = ctx.createOscillator();
    bass.type = 'triangle';
    bass.frequency.value = rootHz / 2; // A1
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.20;
    bass.connect(bassGain).connect(filter);
    bass.start();
    ambientNodes.push(bass);

    // Pad: 4 sine oscillators at chord frequencies, slowly detuned.
    chord.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      // Slow detune LFO for movement
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.02;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 4; // Hz of detune
      lfo.connect(lfoGain).connect(o.detune);
      const g = ctx.createGain();
      g.gain.value = 0.075;
      o.connect(g).connect(filter);
      o.start();
      lfo.start();
      ambientNodes.push(o, lfo);
    });

    // Bright, quick arpeggio plus a soft kick pulse keeps the loop playful
    // and energetic without needing external audio assets.
    let arpStep = 0;
    function arpTick() {
      if (!ctx) return;
      const f = chord[arpStep % chord.length] * 2; // one octave up
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.17, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      o.connect(g).connect(filter);
      o.start(t0);
      o.stop(t0 + 0.24);

      // A short, rounded low-end pulse every four steps adds a simple arcade beat.
      if (arpStep % 4 === 0) {
        const kick = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(125, t0);
        kick.frequency.exponentialRampToValueAtTime(48, t0 + 0.12);
        kickGain.gain.setValueAtTime(0.0001, t0);
        kickGain.gain.linearRampToValueAtTime(0.14, t0 + 0.006);
        kickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
        kick.connect(kickGain).connect(ambientGain);
        kick.start(t0);
        kick.stop(t0 + 0.16);
      }

      arpStep++;
      arpTimer = setTimeout(arpTick, 190);
    }
    arpTimer = setTimeout(arpTick, 190);
  }

  // A looping, filtered noise layer creates a soft surf wash. Its gain
  // follows the frog's distance from the island edge instead of playing
  // at full volume everywhere.
  function buildShoreGraph() {
    if (!ctx || shoreNodes) return;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * 3, sampleRate);
    const channel = buffer.getChannelData(0);
    // Smooth the raw noise slightly before the low-pass filter for a less
    // harsh, more natural shoreline texture.
    let previous = 0;
    for (let i = 0; i < channel.length; i++) {
      const raw = Math.random() * 2 - 1;
      previous = previous * 0.72 + raw * 0.28;
      channel[i] = previous;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 75;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 850;
    lowpass.Q.value = 0.55;
    shoreGain = ctx.createGain();
    shoreGain.gain.value = 0;
    source.connect(highpass).connect(lowpass).connect(shoreGain).connect(masterGain);
    source.start();

    // Slow amplitude breathing gives the surf a gentle ebb-and-flow.
    const swell = ctx.createOscillator();
    swell.type = 'sine';
    swell.frequency.value = 0.12;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.012;
    swell.connect(swellDepth).connect(shoreGain.gain);
    swell.start();
    shoreNodes = [source, swell];
  }

  function setShoreProximity(distance) {
    // Shoreline begins around world radius 840. Blend in from radius 610
    // so the surf gradually grows louder as the frog approaches the beach.
    const proximity = Math.max(0, Math.min(1, (distance - 610) / (840 - 610)));
    shoreTarget = proximity;
    if (shoreGain && Math.abs(shoreApplied - proximity) > 0.015 && ctx?.state === 'running') {
      shoreGain.gain.setTargetAtTime(0.10 * proximity, ctx.currentTime, 0.65);
      shoreApplied = proximity;
    }
  }

  function startAmbient() {
    if (!ctx) return;
    // If the context is still suspended (browser autoplay policy), wait
    // for resume() to finish before we start the oscillators — otherwise
    // they appear to start but produce no sound, and on Chrome the
    // oscillators also get auto-stopped at resume time.
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        if (ctx && ctx.state === 'running') { buildAmbientGraph(); buildShoreGraph(); setShoreProximity(shoreTarget * 230 + 610); }
      }).catch((err) => {
        console.warn('Failed to resume AudioContext (user gesture may be required):', err);
      });
    } else {
      buildAmbientGraph();
      buildShoreGraph();
      setShoreProximity(shoreTarget * 230 + 610);
    }
  }

  function stopAmbient() {
    if (!ambientNodes) return;
    ambientNodes.forEach((n) => { try { n.stop(); } catch {} });
    ambientNodes = null;
    if (shoreNodes) {
      shoreNodes.forEach((node) => { try { node.stop(); } catch {} });
      shoreNodes = null;
    }
    shoreGain = null;
    shoreApplied = -1;
    if (arpTimer) {
      clearTimeout(arpTimer);
      arpTimer = null;
    }
  }

  // Vary ambient pad brightness with day/night (0 = day, 1 = night).
  function setAmbientNightness(t) {
    if (!ambientGain) return;
    ambientGain.gain.linearRampToValueAtTime(
      0.38 + 0.06 * t, ctx.currentTime + 0.4
    );
  }

  return {
    resume,
    setMuted,
    setVolume,
    isMuted,
    getVolume,
    playAttack: () => safePlay(sfx.attack),
    playHit: () => safePlay(sfx.hit),
    playHurt: () => safePlay(sfx.hurt),
    playPickup: () => safePlay(sfx.pickup),
    playPowerUp: () => safePlay(sfx.powerUp),
    playLevelUp: () => safePlay(sfx.levelUp),
    playDeath: () => safePlay(sfx.death),
    playDash: () => safePlay(sfx.dash),
    playMenuClick: () => safePlay(sfx.menuClick),
    playGameOver: () => safePlay(sfx.gameOver),
    playEnemySpawn: () => safePlay(sfx.enemySpawn),
    playFrogJump: () => safePlay(sfx.frogJump),
    playFrogLand: () => safePlay(sfx.frogLand),
    playFrogCroak: () => {
      safePlay(sfx.frogCroakA);
      setTimeout(() => safePlay(sfx.frogCroakB), 85);
    },
    startAmbient,
    stopAmbient,
    setAmbientNightness,
    setShoreProximity
  };
}
