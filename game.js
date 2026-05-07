const game = document.getElementById("game");
const arena = document.getElementById("arena");
const boxer = document.getElementById("boxer");
const flash = document.getElementById("flash");
const startScreen = document.getElementById("start");
const tutorial = document.getElementById("tutorial");
const koCount = document.getElementById("koCount");
const gameOver = document.getElementById("gameOver");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const livesEl = document.getElementById("lives");
const reactionEl = document.getElementById("reaction");
const finalScoreEl = document.getElementById("finalScore");
const recoverEl = document.getElementById("recover");
const coinBalanceEl = document.getElementById("coinBalance");
const menuCoinsEl = document.getElementById("menuCoins");
const menuBestEl = document.getElementById("menuBest");
const coinReplayButton = document.getElementById("coinReplay");
const adReplayButton = document.getElementById("adReplay");
const replayStatusEl = document.getElementById("replayStatus");
const homeButton = document.getElementById("homeButton");
const avatarButton = document.getElementById("avatarButton");
const avatarPanel = document.getElementById("avatarPanel");
const settingsButton = document.getElementById("settingsButton");
const settingsPanel = document.getElementById("settingsPanel");
const soundButton = document.getElementById("soundButton");

const MAX_LIVES = 3;
const RECOVERY_MS = 7000;
const COIN_REPLAY_COST = 1;
const DEFAULT_COINS = 3;
const COIN_GRANT = 1789;
const COIN_GRANT_KEY = "neonGuardCoinGrant1789";
let audioContext = null;
let tinnitus = null;

const state = {
  running: false,
  knockedOut: false,
  score: 0,
  combo: 0,
  lives: MAX_LIVES,
  wave: 0,
  lastReaction: null,
  activeSignals: new Map(),
  spawnTimer: null,
  tutorialTimer: null,
  koCountdownTimers: [],
  koSpeechUtterances: [],
  speechUnlocked: false,
  tutorialActive: false,
  recoveryTimer: null,
  recoveryStartedAt: 0,
  recoveryTicker: null,
  coins: readCoins(),
  bestScore: readBestScore(),
  avatar: readAvatar(),
  muted: readMuted(),
  watchingAd: false,
};

const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const makeId = () =>
  window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function readCoins() {
  const saved = Number(localStorage.getItem("neonGuardCoins"));
  let coins = Number.isFinite(saved) ? saved : DEFAULT_COINS;
  if (localStorage.getItem(COIN_GRANT_KEY) !== "true") {
    coins += COIN_GRANT;
    localStorage.setItem(COIN_GRANT_KEY, "true");
    localStorage.setItem("neonGuardCoins", String(coins));
  }
  return coins;
}

function saveCoins() {
  localStorage.setItem("neonGuardCoins", String(state.coins));
}

function readBestScore() {
  const saved = Number(localStorage.getItem("neonGuardBestScore"));
  return Number.isFinite(saved) ? saved : 0;
}

function saveBestScore() {
  localStorage.setItem("neonGuardBestScore", String(state.bestScore));
}

function readAvatar() {
  const saved = localStorage.getItem("neonGuardAvatar");
  return ["cyan", "red", "green"].includes(saved) ? saved : "cyan";
}

function saveAvatar() {
  localStorage.setItem("neonGuardAvatar", state.avatar);
}

function readMuted() {
  return localStorage.getItem("neonGuardMuted") === "true";
}

function saveMuted() {
  localStorage.setItem("neonGuardMuted", String(state.muted));
}

function applyAvatar() {
  game.classList.remove("avatar-red", "avatar-green");
  if (state.avatar !== "cyan") game.classList.add(`avatar-${state.avatar}`);
  document.querySelectorAll(".avatar-choice").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.avatar === state.avatar));
  });
}

function updateSoundButton() {
  if (soundButton) soundButton.textContent = state.muted ? "Son OFF" : "Son ON";
}

function pickVoice(langPrefix) {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang?.toLowerCase().startsWith(langPrefix.toLowerCase())) ??
    voices[0] ??
    null
  );
}

function unlockSpeech() {
  if (state.muted || state.speechUnlocked || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume?.();
  const unlock = new SpeechSynthesisUtterance(".");
  unlock.volume = 0.01;
  unlock.rate = 1.5;
  unlock.pitch = 1;
  const voice = pickVoice("fr");
  if (voice) unlock.voice = voice;
  window.speechSynthesis.speak(unlock);
  state.speechUnlocked = true;
}

function updateReplayActions(message = "") {
  if (coinBalanceEl) coinBalanceEl.textContent = `Pieces: ${state.coins}`;
  if (menuCoinsEl) menuCoinsEl.textContent = String(state.coins);
  if (menuBestEl) menuBestEl.textContent = String(state.bestScore);
  if (coinReplayButton) {
    coinReplayButton.disabled = state.watchingAd || state.coins < COIN_REPLAY_COST;
  }
  if (adReplayButton) adReplayButton.disabled = state.watchingAd;
  if (replayStatusEl) replayStatusEl.textContent = message;
}

function attackFromAngle(angle) {
  const horizontal = Math.cos(angle);
  const vertical = Math.sin(angle);

  if (horizontal > 0.28) return "hook-left";
  if (horizontal < -0.28) return "hook-right";
  if (vertical > 0.38) return horizontal >= 0 ? "uppercut-left" : "uppercut-right";
  return vertical < 0 ? "straight-right" : "straight-left";
}

function levelSettings() {
  const rawPressure = Math.min(state.wave / 110, 1);
  const pressure = rawPressure * rawPressure * (3 - 2 * rawPressure);
  const latePressure = Math.max(0, (state.wave - 32) / 90);
  const distractorCount =
    (state.wave >= 6 ? 1 : 0) +
    (state.wave >= 22 ? 1 : 0) +
    (state.wave >= 44 ? 1 : 0) +
    (Math.random() < latePressure * 0.35 ? 1 : 0);
  const lifetimeMin = 2300 - pressure * 820;
  const lifetimeMax = 2900 - pressure * 1020;
  return {
    delay: rand(620 - pressure * 300, 1320 - pressure * 620),
    lifetime: rand(lifetimeMin, lifetimeMax),
    distractorCount,
    size: rand(48 - pressure * 8, 64 - pressure * 10),
    radiusNoise: rand(-14 - pressure * 26, 18 + pressure * 34),
    pressure,
  };
}

function fakeVisuals(pressure) {
  const shapePool = [
    "circle",
    "diamond",
    ...(state.wave >= 10 ? ["triangle"] : []),
    ...(state.wave >= 14 ? ["bar"] : []),
    ...(state.wave >= 18 ? ["wide-bar"] : []),
    ...(state.wave >= 22 ? ["pill"] : []),
    ...(state.wave >= 26 ? ["thin-bar"] : []),
    ...(state.wave >= 30 ? ["hexagon"] : []),
    ...(state.wave >= 34 ? ["corner"] : []),
    ...(state.wave >= 38 ? ["soft-square"] : []),
    ...(state.wave >= 46 ? ["ring"] : []),
    ...(state.wave >= 54 ? ["slash"] : []),
    ...(state.wave >= 64 ? ["small-square"] : []),
    ...(state.wave >= 76 ? ["square"] : []),
  ];
  const colorPool = [
    "#ff345d",
    "#ffe066",
    "#47d9ff",
    ...(state.wave >= 18 ? ["#b8ff68"] : []),
    ...(state.wave >= 32 ? ["#48ffcf"] : []),
    ...(state.wave >= 52 ? ["#42f48f"] : []),
    ...(state.wave >= 70 ? ["#62ffac"] : []),
  ];
  const shape = shapePool[Math.floor(rand(0, shapePool.length))];
  const color = colorPool[Math.floor(rand(0, colorPool.length))];
  const moves = state.wave >= 32 && Math.random() < pressure * 0.55;
  const drift = rand(18 + pressure * 16, 48 + pressure * 30);

  return {
    shape,
    color,
    moves,
    dx: `${Math.cos(rand(0, Math.PI * 2)) * drift}px`,
    dy: `${Math.sin(rand(0, Math.PI * 2)) * drift}px`,
    duration: `${rand(900 - pressure * 260, 1500 - pressure * 360)}ms`,
  };
}

function updateHud() {
  if (scoreEl) scoreEl.textContent = String(state.score);
  if (comboEl) comboEl.textContent = `x${state.combo}`;
  updateDamageBlur();
  livesEl.setAttribute("aria-label", `${state.lives} vies sur ${MAX_LIVES}`);
  livesEl.innerHTML = "";
  for (let index = 0; index < MAX_LIVES; index += 1) {
    const pip = document.createElement("span");
    pip.className = index < state.lives ? "life-pip full" : "life-pip empty";
    livesEl.appendChild(pip);
  }
  reactionEl.textContent = state.lastReaction === null ? "-- ms" : `${state.lastReaction} ms`;
  updateRecoveryText();
}

function startGame() {
  initAudio();
  unlockSpeech();
  stopTinnitus();
  clearTimeout(state.tutorialTimer);
  clearKoCountdown();
  clearAllSignals();
  clearRecovery();
  state.running = false;
  state.knockedOut = false;
  state.score = 0;
  state.combo = 0;
  state.lives = MAX_LIVES;
  state.wave = 0;
  state.lastReaction = null;
  state.watchingAd = false;
  state.tutorialActive = true;
  game.classList.remove("is-menu", "ko-down");
  game.classList.add("is-tutorial");
  boxer.classList.remove("laughing");
  updateDamageBlur();
  startScreen.classList.add("hidden");
  gameOver.classList.add("hidden");
  gameOver.classList.remove("countdown-replay");
  koCount?.classList.add("hidden");
  tutorial.classList.remove("hidden");
  updateReplayActions();
  updateHud();
  state.tutorialTimer = setTimeout(() => {
    state.tutorialActive = false;
    state.running = true;
    game.classList.remove("is-tutorial");
    tutorial.classList.add("hidden");
    scheduleNextSpawn(350);
  }, 3200);
}

function endGame() {
  state.running = false;
  state.knockedOut = true;
  stopTinnitus();
  clearTimeout(state.tutorialTimer);
  state.tutorialActive = false;
  clearKoCountdown();
  clearTimeout(state.spawnTimer);
  clearRecovery();
  clearAllSignals();
  game.classList.remove("ko-rush");
  boxer.classList.remove("ko-barrage");
  boxer.classList.add("laughing");
  game.classList.remove("is-tutorial");
  game.classList.add("is-menu");
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    saveBestScore();
  }
  finalScoreEl.textContent = String(state.score);
  startScreen.classList.add("hidden");
  koCount?.classList.add("hidden");
  tutorial.classList.add("hidden");
  gameOver.classList.remove("countdown-replay");
  gameOver.classList.remove("hidden");
  playLaughSound();
  speakTaunt();
  updateReplayActions();
}

function replayWithCoin() {
  if (state.watchingAd || state.coins < COIN_REPLAY_COST) return;
  state.coins -= COIN_REPLAY_COST;
  saveCoins();
  updateReplayActions();
  startGame();
}

function replayWithAd() {
  if (state.watchingAd) return;
  state.watchingAd = true;
  clearKoCountdown();
  updateReplayActions("Pub en cours...");
  setTimeout(() => {
    state.watchingAd = false;
    startGame();
  }, 2500);
}

function returnHome() {
  state.running = false;
  state.knockedOut = false;
  state.watchingAd = false;
  stopTinnitus();
  clearTimeout(state.tutorialTimer);
  state.tutorialActive = false;
  clearKoCountdown();
  clearTimeout(state.spawnTimer);
  clearRecovery();
  clearAllSignals();
  game.classList.remove("is-tutorial", "ko-down", "ko-rush", "damaged-vision");
  game.classList.add("is-menu");
  boxer.classList.remove("laughing", "ko-barrage");
  gameOver.classList.add("hidden");
  gameOver.classList.remove("countdown-replay");
  koCount?.classList.add("hidden");
  tutorial.classList.add("hidden");
  startScreen.classList.remove("hidden");
  state.lives = MAX_LIVES;
  state.combo = 0;
  state.lastReaction = null;
  updateDamageBlur();
  updateHud();
  updateReplayActions();
}

function scheduleNextSpawn(delay) {
  clearTimeout(state.spawnTimer);
  if (!state.running || state.knockedOut || state.tutorialActive) return;
  state.spawnTimer = setTimeout(spawnWave, delay);
}

function spawnWave() {
  if (!state.running || state.knockedOut) return;
  state.wave += 1;
  const settings = levelSettings();
  const signals = [false, ...Array.from({ length: settings.distractorCount }, () => true)];
  for (let index = 0; index < signals.length; index += 1) {
    setTimeout(() => spawnSignal(settings, signals[index]), index * rand(60, 150));
  }
  scheduleNextSpawn(settings.delay);
}

function spawnSignal(settings, isFake = false) {
  if (!state.running || state.knockedOut) return;

  const rect = arena.getBoundingClientRect();
  const boxerRect = boxer.getBoundingClientRect();
  const centerX = boxerRect.left - rect.left + boxerRect.width / 2;
  const centerY = boxerRect.top - rect.top + boxerRect.height * 0.43;
  const safePadding = Math.max(72, settings.size * 1.8);
  const forbidden = {
    left: boxerRect.left - rect.left - safePadding,
    right: boxerRect.right - rect.left + safePadding,
    top: boxerRect.top - rect.top - safePadding * 0.75,
    bottom: boxerRect.bottom - rect.top + safePadding * 0.35,
  };
  let angle = rand(0, Math.PI * 2);
  let x = centerX;
  let y = centerY;

  for (let attempt = 0; attempt < 32; attempt += 1) {
    angle = rand(0, Math.PI * 2);
    const baseRadius = Math.min(rect.width, rect.height) * rand(0.42, 0.56);
    const radius = baseRadius + settings.radiusNoise;
    x = clamp(centerX + Math.cos(angle) * radius, 42, rect.width - 42);
    y = clamp(centerY + Math.sin(angle) * radius, 92, rect.height - 46);
    const insideForbidden =
      x > forbidden.left && x < forbidden.right && y > forbidden.top && y < forbidden.bottom;
    if (!insideForbidden) break;
  }

  const fake = isFake ? fakeVisuals(settings.pressure) : null;
  const id = makeId();
  const signal = document.createElement("button");

  signal.type = "button";
  signal.className = isFake
    ? `signal fake shape-${fake.shape}${fake.moves ? " moving" : ""}`
    : "signal target";
  signal.style.left = `${x}px`;
  signal.style.top = `${y}px`;
  signal.style.setProperty("--size", `${settings.size}px`);
  if (fake) {
    signal.style.setProperty("--signal-color", fake.color);
    signal.style.setProperty("--move-x", fake.dx);
    signal.style.setProperty("--move-y", fake.dy);
    signal.style.setProperty("--move-duration", fake.duration);
  }
  signal.setAttribute("aria-label", isFake ? "Leurre a ignorer" : "Carre vert");

  const data = {
    id,
    element: signal,
    bornAt: performance.now(),
    isFake,
    angle,
    attack: attackFromAngle(angle),
    timeout: null,
  };

  signal.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleSignalClick(id);
  });

  data.timeout = setTimeout(() => expireSignal(id), settings.lifetime);
  state.activeSignals.set(id, data);
  arena.appendChild(signal);
}

function handleSignalClick(id) {
  const signal = state.activeSignals.get(id);
  if (!signal || !state.running || state.knockedOut) return;

  clearTimeout(signal.timeout);
  state.activeSignals.delete(id);

  if (signal.isFake) {
    signal.element.classList.add("missed");
    registerFailure(signal.attack);
    setTimeout(() => signal.element.remove(), 190);
    return;
  }

  const reaction = Math.round(performance.now() - signal.bornAt);
  const speedBonus = Math.max(0, 720 - reaction);
  const comboMultiplier = 1 + Math.floor(state.combo / 5) * 0.25;
  const points = Math.round((100 + speedBonus) * comboMultiplier);

  state.combo += 1;
  state.score += points;
  state.lastReaction = reaction;
  signal.element.classList.add("hit");
  dodge(signal.angle);
  pulse("good");
  updateHud();
  setTimeout(() => signal.element.remove(), 150);
}

function expireSignal(id) {
  const signal = state.activeSignals.get(id);
  if (!signal || !state.running || state.knockedOut) return;

  state.activeSignals.delete(id);
  signal.element.classList.add("missed");

  if (signal.isFake) {
    state.score += 25 + state.combo * 3;
    updateHud();
  } else {
    registerFailure(signal.attack);
  }

  setTimeout(() => signal.element.remove(), 190);
}

function registerFailure(attack = attackFromAngle(rand(0, Math.PI * 2))) {
  state.combo = 0;
  state.lives = Math.max(0, state.lives - 1);
  state.lastReaction = null;
  playImpactSound();
  updateDamageBlur();
  updateTinnitus();
  throwPunch(attack);
  updateHud();

  if (state.lives <= 0) {
    triggerKnockout();
  } else {
    scheduleRecovery();
  }
}

function updateDamageBlur() {
  const missingLives = MAX_LIVES - state.lives;
  const blur = state.knockedOut ? 3.6 : missingLives * 1.25;
  const dim = state.knockedOut ? 0.48 : missingLives * 0.16;
  const criticalVision = state.lives === 1 && !state.knockedOut;
  const oscillation = criticalVision ? 2.2 : 0;
  const duration = criticalVision ? 900 : 1400;
  game.style.setProperty("--damage-blur", `${blur}px`);
  game.style.setProperty("--damage-dim", String(dim));
  game.style.setProperty("--osc-amount", `${oscillation}px`);
  game.style.setProperty("--osc-duration", `${duration}ms`);
  game.classList.toggle("damaged-vision", criticalVision);
}

function initAudio() {
  if (state.muted) return;
  if (audioContext) {
    if (audioContext.state === "suspended") audioContext.resume();
    return;
  }

  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  audioContext = new AudioCtor();
}

function fadeOutAndStop(nodes, duration = 0.35) {
  if (!audioContext || !nodes) return;

  const now = audioContext.currentTime;
  nodes.gain.gain.cancelScheduledValues(now);
  nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, now);
  nodes.gain.gain.linearRampToValueAtTime(0.0001, now + duration);
  for (const source of nodes.sources) {
    source.stop(now + duration + 0.03);
  }
}

function createNoiseSource() {
  const bufferSize = audioContext.sampleRate * 2;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const output = buffer.getChannelData(0);
  let last = 0;

  for (let index = 0; index < bufferSize; index += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.025 * white) / 1.025;
    output[index] = last * 3.5;
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function playImpactSound(intensity = 1) {
  if (state.muted) return;
  initAudio();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const thump = audioContext.createOscillator();
  const crack = audioContext.createOscillator();
  const thumpGain = audioContext.createGain();
  const crackGain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  thump.type = "sine";
  thump.frequency.setValueAtTime(95, now);
  thump.frequency.exponentialRampToValueAtTime(42, now + 0.13);
  thumpGain.gain.setValueAtTime(0.42 * intensity, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  crack.type = "square";
  crack.frequency.setValueAtTime(170, now);
  crack.frequency.exponentialRampToValueAtTime(70, now + 0.07);
  crackGain.gain.setValueAtTime(0.12 * intensity, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(620, now);

  thump.connect(thumpGain).connect(filter);
  crack.connect(crackGain).connect(filter);
  filter.connect(audioContext.destination);
  thump.start(now);
  crack.start(now);
  thump.stop(now + 0.16);
  crack.stop(now + 0.09);
}

function playBarrageSounds() {
  if (state.muted) return;
  initAudio();
  if (!audioContext) return;

  [110, 310, 510, 720, 930].forEach((delay, index) => {
    setTimeout(() => {
      playImpactSound(index % 2 === 0 ? 1.18 : 1);
    }, delay);
  });
}

function playLaughSound() {
  if (state.muted) return;
  initAudio();
  if (!audioContext) return;

  const now = audioContext.currentTime;
  [0, 0.18, 0.36, 0.54].forEach((offset, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(92 - index * 6, now + offset);
    oscillator.frequency.exponentialRampToValueAtTime(58 - index * 4, now + offset + 0.18);
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.linearRampToValueAtTime(0.46, now + offset + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(260, now + offset);
    filter.Q.setValueAtTime(1.1, now + offset);
    oscillator.connect(gain).connect(filter).connect(audioContext.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.23);
  });
}

function speakTaunt() {
  if (state.muted || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume?.();
  const taunt = new SpeechSynthesisUtterance("Retourne t'entrainer petite salope");
  taunt.lang = "fr-FR";
  taunt.rate = 0.82;
  taunt.pitch = 0.42;
  taunt.volume = 1;
  const voice = pickVoice("fr");
  if (voice) taunt.voice = voice;
  setTimeout(() => window.speechSynthesis.speak(taunt), 780);
}

function speakCount(number) {
  if (state.muted || !("speechSynthesis" in window)) return;
  const words = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume?.();
  const count = new SpeechSynthesisUtterance(words[number - 1]);
  count.lang = "en-US";
  const voice = pickVoice("en");
  if (voice) count.voice = voice;
  count.rate = 0.86;
  count.pitch = 0.62;
  count.volume = 1;
  state.koSpeechUtterances.push(count);
  window.speechSynthesis.speak(count);
}

function clearKoCountdown() {
  for (const timer of state.koCountdownTimers) clearTimeout(timer);
  state.koCountdownTimers = [];
  state.koSpeechUtterances = [];
  koCount?.classList.add("hidden");
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function startKoCountdown() {
  clearKoCountdown();
  if (!koCount) {
    endGame();
    return;
  }

  updateReplayActions();
  gameOver.classList.add("countdown-replay");
  gameOver.classList.remove("hidden");
  koCount.classList.remove("hidden");
  for (let number = 1; number <= 10; number += 1) {
    const timer = setTimeout(() => {
      koCount.textContent = String(number);
      koCount.classList.remove("pulse");
      void koCount.offsetWidth;
      koCount.classList.add("pulse");
      speakCount(number);
    }, (number - 1) * 900);
    state.koCountdownTimers.push(timer);
  }

  state.koCountdownTimers.push(
    setTimeout(() => {
      koCount.classList.add("hidden");
      endGame();
    }, 10 * 900 + 520),
  );
}

function startTinnitus() {
  if (state.muted) return;
  initAudio();
  if (!audioContext || tinnitus) return;

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const tremolo = audioContext.createOscillator();
  const tremoloGain = audioContext.createGain();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(3650, now);
  tremolo.type = "sine";
  tremolo.frequency.setValueAtTime(6.5, now);
  tremoloGain.gain.setValueAtTime(0.018, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.045, now + 0.35);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(3650, now);
  filter.Q.setValueAtTime(9, now);

  tremolo.connect(tremoloGain).connect(gain.gain);
  oscillator.connect(filter).connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  tremolo.start(now);
  tinnitus = { oscillator, tremolo, gain };
}

function stopTinnitus() {
  if (!audioContext || !tinnitus) return;

  const now = audioContext.currentTime;
  tinnitus.gain.gain.cancelScheduledValues(now);
  tinnitus.gain.gain.setValueAtTime(tinnitus.gain.gain.value, now);
  tinnitus.gain.gain.linearRampToValueAtTime(0.0001, now + 0.18);
  tinnitus.oscillator.stop(now + 0.2);
  tinnitus.tremolo.stop(now + 0.2);
  tinnitus = null;
}

function updateTinnitus() {
  if (state.running && !state.knockedOut && state.lives === 1) {
    startTinnitus();
  } else {
    stopTinnitus();
  }
}

function triggerKnockout() {
  state.knockedOut = true;
  updateDamageBlur();
  clearTimeout(state.spawnTimer);
  clearRecovery();
  boxer.classList.add("ko-barrage");
  game.classList.add("ko-rush");
  playBarrageSounds();
  setTimeout(() => {
    clearAllSignals();
    game.classList.add("ko-down");
    startKoCountdown();
  }, 1120);
}

function scheduleRecovery() {
  clearRecovery();
  if (!state.running || state.knockedOut || state.lives <= 0 || state.lives >= MAX_LIVES) return;

  state.recoveryStartedAt = performance.now();
  state.recoveryTimer = setTimeout(recoverLife, RECOVERY_MS);
  state.recoveryTicker = setInterval(updateRecoveryText, 120);
}

function recoverLife() {
  clearRecovery();
  if (!state.running || state.knockedOut || state.lives >= MAX_LIVES) return;

  state.lives += 1;
  pulse("heal");
  updateTinnitus();
  updateHud();

  if (state.lives < MAX_LIVES) {
    scheduleRecovery();
  }
}

function clearRecovery() {
  clearTimeout(state.recoveryTimer);
  clearInterval(state.recoveryTicker);
  state.recoveryTimer = null;
  state.recoveryTicker = null;
  state.recoveryStartedAt = 0;
  updateRecoveryText();
}

function updateRecoveryText() {
  if (!recoverEl) return;
  if (!state.running) {
    recoverEl.textContent = "max";
    return;
  }
  if (state.knockedOut || state.lives <= 0) {
    recoverEl.textContent = "ko";
    return;
  }
  if (state.lives >= MAX_LIVES) {
    recoverEl.textContent = "max";
    return;
  }
  if (!state.recoveryStartedAt) {
    recoverEl.textContent = "recup";
    return;
  }

  const elapsed = performance.now() - state.recoveryStartedAt;
  const remaining = Math.max(0, Math.ceil((RECOVERY_MS - elapsed) / 1000));
  recoverEl.textContent = `+1 dans ${remaining}s`;
}

function throwPunch(attack) {
  const className = `attack-${attack}`;
  const attackClasses = [
    "attack-straight-left",
    "attack-straight-right",
    "attack-hook-left",
    "attack-hook-right",
    "attack-uppercut-left",
    "attack-uppercut-right",
  ];

  boxer.classList.remove(...attackClasses, "impact");
  game.classList.remove("shake");
  void boxer.offsetWidth;
  boxer.classList.add(className);

  setTimeout(() => {
    pulse("bad");
    impact();
  }, attack.includes("hook") ? 150 : attack.includes("straight") ? 120 : 100);

  setTimeout(() => {
    boxer.classList.remove(className);
  }, attack.includes("hook") ? 350 : attack.includes("uppercut") ? 330 : 310);
}

function dodge(angle) {
  const degrees = ((angle * 180) / Math.PI + 360) % 360;
  let className = "dodge-right";
  if (degrees > 45 && degrees <= 135) className = "dodge-down";
  if (degrees > 135 && degrees <= 225) className = "dodge-left";
  if (degrees > 225 && degrees <= 315) className = "dodge-up";

  boxer.classList.remove("dodge-left", "dodge-right", "dodge-up", "dodge-down");
  void boxer.offsetWidth;
  boxer.classList.add(className);
  setTimeout(() => boxer.classList.remove(className), 110);
}

function impact() {
  boxer.classList.remove("impact");
  game.classList.remove("shake");
  void boxer.offsetWidth;
  boxer.classList.add("impact");
  game.classList.add("shake");
  setTimeout(() => {
    boxer.classList.remove("impact");
    game.classList.remove("shake");
  }, 140);
}

function pulse(type) {
  flash.className = `flash ${type}`;
  setTimeout(() => {
    flash.className = "flash";
  }, type === "bad" ? 170 : 150);
}

function clearAllSignals() {
  for (const signal of state.activeSignals.values()) {
    clearTimeout(signal.timeout);
    signal.element.remove();
  }
  state.activeSignals.clear();
}

function togglePanel(panel) {
  if (!panel) return;
  const shouldOpen = panel.classList.contains("hidden");
  avatarPanel?.classList.add("hidden");
  settingsPanel?.classList.add("hidden");
  if (shouldOpen) panel.classList.remove("hidden");
}

startScreen.addEventListener("click", (event) => {
  if (event.target.closest(".menu-bar, .menu-panel")) return;
  startGame();
});

avatarButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  togglePanel(avatarPanel);
});

settingsButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  togglePanel(settingsPanel);
});

avatarPanel?.addEventListener("click", (event) => {
  event.stopPropagation();
  const choice = event.target.closest(".avatar-choice");
  if (!choice) return;
  state.avatar = choice.dataset.avatar;
  saveAvatar();
  applyAvatar();
  avatarPanel.classList.add("hidden");
});

settingsPanel?.addEventListener("click", (event) => {
  event.stopPropagation();
});

soundButton?.addEventListener("click", () => {
  state.muted = !state.muted;
  saveMuted();
  if (state.muted) stopTinnitus();
  else {
    state.speechUnlocked = false;
    unlockSpeech();
  }
  updateSoundButton();
});

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

coinReplayButton?.addEventListener("click", replayWithCoin);
adReplayButton?.addEventListener("click", replayWithAd);
homeButton?.addEventListener("click", returnHome);

window.addEventListener("blur", () => {
  if (!state.running) return;
  clearTimeout(state.spawnTimer);
});

window.addEventListener("focus", () => {
  if (!state.running) return;
  scheduleNextSpawn(350);
});

updateHud();
updateReplayActions();
applyAvatar();
updateSoundButton();
