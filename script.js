"use strict";

/* =========================================================
   SEVEN SECONDS
   Two game modes plus a mixed deck. Mobile audio retains the
   proven Web Audio API implementation and HTML Audio fallback.
   ========================================================= */

const modeScreen = document.getElementById("modeScreen");
const gameScreen = document.getElementById("gameScreen");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const modeButton = document.getElementById("modeButton");
const nextButton = document.getElementById("nextButton");
const startButton = document.getElementById("startButton");
const revealButton = document.getElementById("revealButton");
const shareButton = document.getElementById("shareButton");
const itemType = document.getElementById("itemType");
const questionText = document.getElementById("questionText");
const answerArea = document.getElementById("answerArea");
const answerText = document.getElementById("answerText");
const referenceText = document.getElementById("referenceText");
const timerNumber = document.getElementById("timerNumber");

const AUDIO_VERSION = "20260711-1";
const GO_SOUND_URL = `assets/go.mp3?v=${AUDIO_VERSION}`;
const DING_SOUND_URL = `assets/ding.mp3?v=${AUDIO_VERSION}`;

const DEFAULT_THEME = {
  title: "Seven Seconds",
  description: "Choose Name 3, Quick Quiz or a Mixed Game and beat the seven-second timer.",
  name3File: "name3-prompts.csv",
  quizFile: "quiz-questions.csv",
  backgroundImage: "assets/background.png",
  accentColor: "#168dff",
  timerSeconds: 7,
  shareText: "Can you beat the Seven Seconds clock?"
};

let themeConfig = { ...DEFAULT_THEME };
let TIMER_SECONDS = DEFAULT_THEME.timerSeconds;
let libraries = { name3: [], quiz: [] };
let decks = {};
let currentMode = null;
let currentItem = null;
let timerTick = null;
let timerFinish = null;
let timerStartedAt = 0;
let isTimerRunning = false;
let timerCompleted = false;
let bellPlayed = false;

/* =========================================================
   AUDIO ENGINE — preserve mobile user-gesture unlocking.
   ========================================================= */

class GameAudio {
  constructor() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.supported = Boolean(AudioContextClass);
    this.context = this.supported ? new AudioContextClass({ latencyHint: "interactive" }) : null;
    this.buffers = { go: null, ding: null };
    this.loadingPromise = this.supported ? this.loadAllSounds() : Promise.resolve();

    this.fallback = {
      go: new Audio(GO_SOUND_URL),
      ding: new Audio(DING_SOUND_URL)
    };

    this.fallback.go.preload = "auto";
    this.fallback.ding.preload = "auto";
    this.fallback.go.playsInline = true;
    this.fallback.ding.playsInline = true;
    this.fallback.go.load();
    this.fallback.ding.load();
  }

  async fetchAndDecode(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load ${url}. HTTP status: ${response.status}`);
    const audioData = await response.arrayBuffer();
    return this.context.decodeAudioData(audioData.slice(0));
  }

  async loadAllSounds() {
    try {
      const [goBuffer, dingBuffer] = await Promise.all([
        this.fetchAndDecode(GO_SOUND_URL),
        this.fetchAndDecode(DING_SOUND_URL)
      ]);
      this.buffers.go = goBuffer;
      this.buffers.ding = dingBuffer;
      console.info("GO and DING sounds loaded successfully.");
    } catch (error) {
      console.error("Web Audio loading failed. HTML Audio fallback will be used.", error);
    }
  }

  unlockFromUserGesture() {
    if (!this.supported || !this.context) {
      this.unlockFallbackAudio();
      return Promise.resolve();
    }

    const resumePromise = this.context.state === "suspended" ? this.context.resume() : Promise.resolve();

    try {
      const oscillator = this.context.createOscillator();
      const silentGain = this.context.createGain();
      silentGain.gain.value = 0;
      oscillator.connect(silentGain);
      silentGain.connect(this.context.destination);
      oscillator.start();
      oscillator.stop(this.context.currentTime + 0.01);
    } catch (error) {
      console.warn("Silent audio unlock signal failed:", error);
    }

    this.unlockFallbackAudio();
    return resumePromise.catch((error) => console.warn("AudioContext could not resume:", error));
  }

  unlockFallbackAudio() {
    /*
      GO is played directly by the same tap, which unlocks its own
      HTML Audio element. Prime only DING here so it may play seven
      seconds later without another user gesture.
    */
    [this.fallback.ding].forEach((audio) => {
      try {
        audio.muted = true;
        audio.currentTime = 0;
        const promise = audio.play();
        if (promise && typeof promise.then === "function") {
          promise.then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
          }).catch(() => { audio.muted = false; });
        } else {
          audio.muted = false;
        }
      } catch (error) {
        audio.muted = false;
      }
    });
  }

  async ensureReady() {
    /*
      Do not block the seven-second timer on network decoding. The
      buffers continue loading in the background, and play() uses the
      already-preloaded HTML Audio fallback whenever a buffer is not
      ready yet. This avoids a stalled Start button on mobile Safari.
    */
    if (this.supported && this.context && this.context.state === "suspended") {
      try { await this.context.resume(); }
      catch (error) { console.warn("AudioContext resume failed:", error); }
    }
  }

  play(name) {
      if (
        this.supported &&
        this.context &&
        this.context.state === "running" &&
        this.buffers[name]
      ) {
      try {
        const source = this.context.createBufferSource();
        const gain = this.context.createGain();
        source.buffer = this.buffers[name];
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(this.context.destination);
        source.start(0);
        return;
      } catch (error) {
        console.warn(`Web Audio playback failed for ${name}. Trying fallback.`, error);
      }
    }
    this.playFallback(name);
  }

  playFallback(name) {
    const audio = this.fallback[name];
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 1;
      const promise = audio.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch((error) => console.error(`${name.toUpperCase()} sound failed:`, error));
      }
    } catch (error) {
      console.error(`${name.toUpperCase()} sound failed:`, error);
    }
  }
}

const gameAudio = new GameAudio();

/* =========================================================
   DATA AND DECKS
   ========================================================= */

initializeGame();

async function initializeGame() {
  try {
    themeConfig = await loadThemeConfig();
    applyThemeConfig(themeConfig);
    const [name3Rows, quizRows] = await Promise.all([
      loadCSV(themeConfig.name3File),
      loadCSV(themeConfig.quizFile)
    ]);

    libraries.name3 = name3Rows.map((row) => ({
      type: "name3",
      prompt: row.prompt,
      answer: "",
      reference: ""
    }));
    libraries.quiz = quizRows.map((row) => ({
      type: "quiz",
      prompt: row.question,
      answer: row.answer,
      reference: row.reference || ""
    }));

    decks = {
      name3: new SevenSecondsEngine.NoRepeatDeck(libraries.name3),
      quiz: new SevenSecondsEngine.NoRepeatDeck(libraries.quiz),
      mixed: new SevenSecondsEngine.NoRepeatDeck([...libraries.name3, ...libraries.quiz])
    };

    modeButtons.forEach((button) => { button.disabled = false; });
  } catch (error) {
    console.error("Could not initialise game content:", error);
    modeButtons.forEach((button) => { button.disabled = true; });
    document.querySelector(".mode-intro").textContent = "Game content could not be loaded. Please refresh and try again.";
  }
}

async function loadThemeConfig() {
  try {
    const response = await fetch(`theme.json?v=${AUDIO_VERSION}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
    return { ...DEFAULT_THEME, ...(await response.json()) };
  } catch (error) {
    console.warn("Could not load theme.json. Using defaults.", error);
    return { ...DEFAULT_THEME };
  }
}

async function loadCSV(file) {
  const response = await fetch(`${file}?v=${AUDIO_VERSION}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${file}. HTTP status ${response.status}`);
  const rows = SevenSecondsEngine.rowsToObjects(await response.text());
  if (!rows.length) throw new Error(`No content found in ${file}.`);
  return rows;
}

function applyThemeConfig(config) {
  document.title = config.title;
  document.getElementById("gameDescription").setAttribute("content", config.description);
  document.documentElement.style.setProperty("--accent", config.accentColor);
  document.documentElement.style.setProperty("--background-image", `url("${config.backgroundImage}")`);
  const seconds = Number(config.timerSeconds);
  TIMER_SECONDS = Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_THEME.timerSeconds;
  resetTimerDisplay();
}

function selectMode(mode) {
  if (!decks[mode]) return;
  stopTimer();
  currentMode = mode;
  modeScreen.hidden = true;
  gameScreen.hidden = false;
  showNextItem();
}

function returnToModeScreen() {
  stopTimer();
  currentMode = null;
  currentItem = null;
  gameScreen.hidden = true;
  modeScreen.hidden = false;
  hideAnswer();
  resetTimerDisplay();
}

function showNextItem() {
  stopTimer();
  if (!currentMode || !decks[currentMode]) return;

  currentItem = decks[currentMode].next();
  timerCompleted = false;
  bellPlayed = false;
  itemType.textContent = currentItem.type === "quiz" ? "QUICK QUIZ" : "NAME 3";
  questionText.textContent = currentItem.prompt;
  nextButton.textContent = currentItem.type === "quiz" ? "Next Question ›" : "Next Prompt ›";
  hideAnswer();
  revealButton.hidden = true;
  revealButton.disabled = true;
  resetTimerDisplay();
  setControlsRunning(false);
}

function hideAnswer() {
  answerArea.hidden = true;
  answerText.textContent = "";
  referenceText.textContent = "";
  referenceText.hidden = true;
}

function revealAnswer() {
  if (!currentItem || currentItem.type !== "quiz" || isTimerRunning || !timerCompleted) return;
  answerText.textContent = currentItem.answer;
  referenceText.textContent = currentItem.reference;
  referenceText.hidden = !currentItem.reference;
  answerArea.hidden = false;
  revealButton.hidden = true;
}

/* =========================================================
   SEVEN-SECOND TIMER
   ========================================================= */

async function startTimer() {
  if (isTimerRunning || !currentItem) return;

  // This call must remain directly inside the player's tap handler.
  gameAudio.unlockFromUserGesture();
  setControlsRunning(true);
  resetTimerDisplay();
  timerCompleted = false;
  bellPlayed = false;
  hideAnswer();
  revealButton.hidden = true;
  revealButton.disabled = true;

  /*
    Never await AudioContext.resume() or network decoding here. Some
    mobile browsers keep those promises pending. The timer, GO sound
    and controls must respond synchronously to the player's tap.
  */
  void gameAudio.ensureReady();
  isTimerRunning = true;
  timerStartedAt = performance.now();
  gameAudio.play("go");
  timerTick = window.setInterval(updateTimerDisplay, 50);
  timerFinish = window.setTimeout(finishTimer, TIMER_SECONDS * 1000);
}

function updateTimerDisplay() {
  if (!isTimerRunning) return;
  const elapsedSeconds = (performance.now() - timerStartedAt) / 1000;
  const remaining = Math.max(0, Math.ceil(TIMER_SECONDS - elapsedSeconds));
  timerNumber.textContent = String(remaining);
}

function finishTimer() {
  if (!isTimerRunning) return;
  clearTimerHandles();
  isTimerRunning = false;
  timerCompleted = true;
  timerNumber.textContent = "0";
  setControlsRunning(false);

  if (!bellPlayed) {
    bellPlayed = true;
    gameAudio.play("ding");
  }

  if (currentItem && currentItem.type === "quiz") {
    revealButton.hidden = false;
    revealButton.disabled = false;
  }
}

function stopTimer() {
  clearTimerHandles();
  isTimerRunning = false;
  setControlsRunning(false);
}

function clearTimerHandles() {
  if (timerTick !== null) {
    window.clearInterval(timerTick);
    timerTick = null;
  }
  if (timerFinish !== null) {
    window.clearTimeout(timerFinish);
    timerFinish = null;
  }
}

function resetTimerDisplay() {
  timerNumber.textContent = String(TIMER_SECONDS);
}

function setControlsRunning(running) {
  startButton.disabled = running || !currentItem;
  nextButton.disabled = running || !currentItem;
  modeButton.disabled = running;
  revealButton.disabled = running || !timerCompleted;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && isTimerRunning) {
    stopTimer();
    timerCompleted = false;
    hideAnswer();
    revealButton.hidden = true;
    revealButton.disabled = true;
    resetTimerDisplay();
  }
});

/* =========================================================
   SHARE — quiz answers are deliberately excluded.
   ========================================================= */

async function shareGame() {
  if (!currentItem) return;
  const itemLabel = currentItem.type === "quiz" ? "Quick Quiz" : "Name 3";
  const sharedPrompt = `${itemLabel}: ${currentItem.prompt}`;
  const payload = {
    title: themeConfig.title,
    text: `${themeConfig.shareText}\n\n${sharedPrompt}`,
    url: window.location.href
  };

  if (navigator.share) {
    try { await navigator.share(payload); }
    catch (error) { if (error.name !== "AbortError") console.warn("Sharing failed:", error); }
    return;
  }

  try {
    await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
    alert(currentItem.type === "quiz" ? "Question copied without the answer!" : "Prompt copied to clipboard!");
  } catch (error) {
    console.warn("Clipboard copy failed:", error);
  }
}

modeButtons.forEach((button) => {
  button.disabled = true;
  button.addEventListener("click", () => selectMode(button.dataset.mode));
});
startButton.addEventListener("click", startTimer);
nextButton.addEventListener("click", showNextItem);
revealButton.addEventListener("click", revealAnswer);
shareButton.addEventListener("click", shareGame);
modeButton.addEventListener("click", returnToModeScreen);

// A small read-only test surface supports browser regression checks.
window.__sevenSecondsTest = {
  selectMode,
  showNextItem,
  finishTimer,
  returnToModeScreen,
  getState: () => ({ currentMode, currentItem: currentItem ? { ...currentItem } : null, isTimerRunning, timerCompleted, timerValue: timerNumber.textContent })
};
