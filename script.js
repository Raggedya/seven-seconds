const nextButton = document.getElementById("nextButton");
const startButton = document.getElementById("startButton");
const shareButton = document.getElementById("shareButton");
const questionText = document.getElementById("questionText");
const timerNumber = document.getElementById("timerNumber");
const timerRing = document.getElementById("timerRing");

const goSound = new Audio("assets/go.mp3");
const dingSound = new Audio("assets/ding.mp3");

let allPrompts = [];
let timerInterval = null;
let timeLeft = 7;
let isTimerRunning = false;

fetch("prompts.csv")
  .then((response) => response.text())
  .then((csvText) => {
    allPrompts = parseCSV(csvText);
    showRandomPrompt();
  })
  .catch((error) => {
    console.error("Could not load prompts.csv:", error);
    questionText.textContent = "Could not load prompts.";
  });

function parseCSV(csvText) {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => line.toLowerCase() !== "prompt");
}

function showRandomPrompt() {
  if (!allPrompts.length) {
    questionText.textContent = "No prompts found.";
    return;
  }

  stopTimer();

  const randomIndex = Math.floor(Math.random() * allPrompts.length);
  questionText.textContent = allPrompts[randomIndex];

  resetTimerDisplay();
}

function startTimer() {
  if (isTimerRunning) return;

  isTimerRunning = true;
  timeLeft = 7;
  timerNumber.textContent = timeLeft;
  startButton.disabled = true;

  playSound(goSound);

  timerInterval = setInterval(() => {
    timeLeft -= 1;
    timerNumber.textContent = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      isTimerRunning = false;
      startButton.disabled = false;
      timerNumber.textContent = "0";
      playSound(dingSound);
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  isTimerRunning = false;
  startButton.disabled = false;
}

function resetTimerDisplay() {
  timeLeft = 7;
  timerNumber.textContent = "7";
}

function playSound(sound) {
  sound.pause();
  sound.currentTime = 0;

  const playPromise = sound.play();

  if (playPromise !== undefined) {
    playPromise.catch((error) => {
      console.warn("Sound play blocked or failed:", error);
    });
  }
}

function shareGame() {
  const shareText = questionText.textContent;

  if (navigator.share) {
    navigator.share({
      title: "Seven Seconds",
      text: shareText,
      url: window.location.href
    }).catch((error) => {
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