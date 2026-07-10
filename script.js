"use strict";

/* =========================================================
   SEVEN SECONDS
   Reliable desktop and mobile audio using Web Audio API
   ========================================================= */

const nextButton = document.getElementById("nextButton");
const startButton = document.getElementById("startButton");
const shareButton = document.getElementById("shareButton");
const questionText = document.getElementById("questionText");
const timerNumber = document.getElementById("timerNumber");

/*
  Change AUDIO_VERSION whenever either MP3 is replaced.
  This prevents GitHub Pages, Safari and Chrome from serving
  an older cached copy of the sound.
*/
const AUDIO_VERSION = "20260711-1";

const GO_SOUND_URL = `assets/go.mp3?v=${AUDIO_VERSION}`;
const DING_SOUND_URL = `assets/ding.mp3?v=${AUDIO_VERSION}`;

const TIMER_SECONDS = 7;

let allPrompts = [];
let promptDeck = [];
let timerTick = null;
let timerFinish = null;
let timerStartedAt = 0;
let isTimerRunning = false;

/* =========================================================
   AUDIO ENGINE
   ========================================================= */

class GameAudio {
  constructor() {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    this.supported = Boolean(AudioContextClass);
    this.context = this.supported
      ? new AudioContextClass({ latencyHint: "interactive" })
      : null;

    this.buffers = {
      go: null,
      ding: null
    };

    this.loadingPromise = this.supported
      ? this.loadAllSounds()
      : Promise.resolve();

    /*
      HTML Audio fallback for unusual or older browsers.
      These elements are reused rather than recreated.
    */
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
    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Could not load ${url}. HTTP status: ${response.status}`
      );
    }

    const audioData = await response.arrayBuffer();

    /*
      slice(0) gives decodeAudioData its own copy.
      This avoids compatibility problems in older browsers.
    */
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
      console.error(
        "Web Audio loading failed. HTML Audio fallback will be used.",
        error
      );
    }
  }

  /*
    This must be called directly from the Start Timer button press.
    It resumes the AudioContext and plays a silent signal, which
    unlocks mobile audio for sounds played later by the timer.
  */
  unlockFromUserGesture() {
    if (!this.supported || !this.context) {
      this.unlockFallbackAudio();
      return Promise.resolve();
    }

    const resumePromise =
      this.context.state === "suspended"
        ? this.context.resume()
        : Promise.resolve();

    /*
      Create a silent oscillator immediately inside the click event.
      This firmly associates the audio session with the user's tap.
    */
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

    return resumePromise.catch((error) => {
      console.warn("AudioContext could not resume:", error);
    });
  }

  unlockFallbackAudio() {
    Object.values(this.fallback).forEach((audio) => {
      try {
        audio.muted = true;
        audio.currentTime = 0;

        const promise = audio.play();

        if (promise && typeof promise.then === "function") {
          promise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              audio.muted = false;
            })
            .catch(() => {
              audio.muted = false;
            });
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
      The files normally finish loading before the user presses Start.
      On a slow connection, wait for them before beginning the timer.
    */
    await this.loadingPromise;

    if (
      this.supported &&
      this.context &&
      this.context.state === "suspended"
    ) {
      try {
        await this.context.resume();
      } catch (error) {
        console.warn("AudioContext resume failed:", error);
      }
    }
  }

  play(name) {
    if (
      this.supported &&
      this.context &&
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
        console.warn(
          `Web Audio playback failed for ${name}. Trying fallback.`,
          error
        );
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
        promise.catch((error) => {
          console.error(`${name.toUpperCase()} sound failed:`, error);
        });
      }
    } catch (error) {
      console.error(`${name.toUpperCase()} sound failed:`, error);
    }
  }
}

const gameAudio = new GameAudio();

/* =========================================================
   PROMPTS
   ========================================================= */

fetch(`prompts.csv?v=${AUDIO_VERSION}`, {
  cache: "no-store"
})
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }

    return response.text();
  })
  .then((csvText) => {
    allPrompts = parseSingleColumnCSV(csvText);

    if (!allPrompts.length) {
      throw new Error("No prompts were found in prompts.csv.");
    }

    refillPromptDeck();
    showNextPrompt();
  })
  .catch((error) => {
    console.error("Could not load prompts.csv:", error);
    questionText.textContent = "Could not load prompts.";
  });

function parseSingleColumnCSV(csvText) {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (
    lines.length &&
    lines[0].replace(/^"|"$/g, "").toLowerCase() === "prompt"
  ) {
    lines.shift();
  }

  return lines
    .map((line) => {
      /*
        Remove surrounding CSV quotation marks and convert doubled
        quotation marks back to normal quotation marks.
      */
      if (line.startsWith('"') && line.endsWith('"')) {
        return line
          .slice(1, -1)
          .replace(/""/g, '"')
          .trim();
      }

      return line;
    })
    .filter(Boolean);
}

function refillPromptDeck() {
  promptDeck = [...allPrompts];

  /*
    Fisher-Yates shuffle.
    Each prompt appears once before the deck is reshuffled.
  */
  for (let index = promptDeck.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [promptDeck[index], promptDeck[randomIndex]] = [
      promptDeck[randomIndex],
      promptDeck[index]
    ];
  }
}

function showNextPrompt() {
  stopTimer();

  if (!allPrompts.length) {
    questionText.textContent = "No prompts found.";
    return;
  }

  if (!promptDeck.length) {
    refillPromptDeck();
  }

  questionText.textContent = promptDeck.pop();
  resetTimerDisplay();
}

/* =========================================================
   SEVEN-SECOND TIMER
   ========================================================= */

async function startTimer() {
  if (isTimerRunning) return;

  /*
    Do this first, while the browser still recognises the
    Start Timer button press as an active user gesture.
  */
  const unlockPromise = gameAudio.unlockFromUserGesture();

  setControlsRunning(true);
  resetTimerDisplay();

  try {
    await unlockPromise;
    await gameAudio.ensureReady();

    isTimerRunning = true;
    timerStartedAt = performance.now();

    /*
      Play GO only after both files are loaded and the audio
      session has been unlocked.
    */
    gameAudio.play("go");

    timerTick = window.setInterval(updateTimerDisplay, 50);

    timerFinish = window.setTimeout(
      finishTimer,
      TIMER_SECONDS * 1000
    );
  } catch (error) {
    console.error("Could not start timer:", error);
    stopTimer();
  }
}

function updateTimerDisplay() {
  if (!isTimerRunning) return;

  const elapsedSeconds =
    (performance.now() - timerStartedAt) / 1000;

  const remaining = Math.max(
    0,
    Math.ceil(TIMER_SECONDS - elapsedSeconds)
  );

  timerNumber.textContent = String(remaining);
}

function finishTimer() {
  clearTimerHandles();

  isTimerRunning = false;
  timerNumber.textContent = "0";
  setControlsRunning(false);

  /*
    The DING is played from the already-unlocked AudioContext
    and from a sound buffer already held in memory.
  */
  gameAudio.play("ding");
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
  startButton.disabled = running;
  nextButton.disabled = running;
}

/* =========================================================
   PAGE VISIBILITY
   ========================================================= */

/*
  Stop the timer if the page is sent to the background.
  Mobile browsers throttle timers and may suspend audio while
  a tab is hidden, so silently continuing would be misleading.
*/
document.addEventListener("visibilitychange", () => {
  if (document.hidden && isTimerRunning) {
    stopTimer();
    resetTimerDisplay();
  }
});

/* =========================================================
   SHARE
   ========================================================= */

async function shareGame() {
  const shareText = questionText.textContent.trim();

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Seven Seconds",
        text: shareText,
        url: window.location.href
      });
    } catch (error) {
      /*
        AbortError normally means the player closed the share menu.
      */
      if (error.name !== "AbortError") {
        console.warn("Sharing failed:", error);
      }
    }

    return;
  }

  try {
    await navigator.clipboard.writeText(shareText);
    alert("Prompt copied to clipboard!");
  } catch (error) {
    console.warn("Clipboard copy failed:", error);
  }
}

/* =========================================================
   BUTTONS
   ========================================================= */

startButton.addEventListener("click", startTimer);
nextButton.addEventListener("click", showNextPrompt);
shareButton.addEventListener("click", shareGame);
