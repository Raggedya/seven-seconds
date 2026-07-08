const nextButton = document.getElementById("nextButton");
const startButton = document.getElementById("startButton");
const shareButton = document.getElementById("shareButton");
const questionText = document.getElementById("questionText");
const timerNumber = document.getElementById("timerNumber");

const GO_SRC = "assets/go.mp3?v=3";
const DING_SRC = "assets/ding.mp3?v=3";

let goSound = new Audio(GO_SRC);
let dingSound = new Audio(DING_SRC);

goSound.preload = "auto";
dingSound.preload = "auto";

let allPrompts = [];
let timerInterval = null;
let timeLeft = 7;
let isTimerRunning = false;
let audioUnlocked = false;

fetch("prompts.csv")
  .then(response => response.text())
  .then(csvText => {
    allPrompts = parseCSV(csvText);
    showRandomPrompt();
  })
  .catch(error => {
    console.error("Could not load prompts.csv:", error);
    questionText.textContent = "Could not load prompts.";
  });

function parseCSV(csvText) {
  return csvText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => line.toLowerCase() !== "prompt");
}

function showRandomPrompt() {
  stopTimer();

  if (!allPrompts.length) {
    questionText.textContent = "No prompts found.";
    return;
  }

  const randomIndex = Math.floor(Math.random() * allPrompts.length);
  questionText.textContent = allPrompts[randomIndex];

  resetTimerDisplay();
}

function startTimer() {
  if (isTimerRunning) return;

  unlockAudio();

  isTimerRunning = true;
  timeLeft = 7;
  timerNumber.textContent = timeLeft;
  startButton.disabled = true;
  nextButton.disabled = true;

  playGo();

  timerInterval = setInterval(() => {
    timeLeft -= 1;
    timerNumber.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;

      isTimerRunning = false;
      startButton.disabled = false;
      nextButton.disabled = false;

      timerNumber.textContent = "0";
      playDing();
    }
  }, 1000);
}

function unlockAudio() {
  if (audioUnlocked) return;

  audioUnlocked = true;

  goSound.load();
  dingSound.load();

  // iPhone/Safari unlock trick: quietly touch both audio files during the real button tap.
  [goSound, dingSound].forEach(sound => {
    sound.muted = true;
    sound.currentTime = 0;

    const p = sound.play();

    if (p !== undefined) {
      p.then(() => {
        sound.pause();
        sound.currentTime = 0;
        sound.muted = false;
      }).catch(() => {
        sound.muted = false;
      });
    } else {
      sound.muted = false;
    }
  });
}

function playGo() {
  goSound.pause();
  goSound.currentTime = 0;
  goSound.muted = false;
  goSound.play().catch(error => {
    console.warn("GO sound failed:", error);
  });
}

function playDing() {
  // Fresh Audio object helps mobile Safari replay it reliably after the timer delay.
  const finalDing = new Audio(DING_SRC);
  finalDing.volume = 1;
  finalDing.play().catch(error => {
    console.warn("DING sound failed:", error);
  });
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  isTimerRunning = false;
  startButton.disabled = false;
  nextButton.disabled = false;
}

function resetTimerDisplay() {
  timeLeft = 7;
  timerNumber.textContent = "7";
}

function shareGame() {
  const shareText = questionText.textContent;

  if (navigator.share) {
    navigator.share({
      title: "Seven Seconds",
      text: shareText,
      url: window.location.href
    }).catch(error => {
      console.warn("Share cancelled or failed:", error);
    });
  } else {
    navigator.clipboard.writeText(shareText);
    alert("Prompt copied to clipboard!");
  }
}

startButton.addEventListener("click", startTimer);
nextButton.addEventListener("click", showRandomPrompt);
shareButton.addEventListener("click", shareGame);
