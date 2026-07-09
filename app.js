/**
 * Anchor - Client Logic (Version 1 Scaffold)
 * Handles quiz state, audio effects, accessibility options, and view transitions.
 */

// --- 1. DUMMY DATA STORE ---
// Accessible and easy for developers to remove, replace, or hook into an API
const QUIZ_DATABASE = {
  important: [
    {
      clue: "What is your oldest son's name?",
      target: "Michael",
      distractors: ["James", "Robert", "William"],
      hint: "Think of a name starting with 'M'."
    },
    {
      clue: "What year were you born in?",
      target: "1953",
      distractors: ["1945", "1958", "1962"],
      hint: "It was in the early 1950s."
    }
  ],
  everyday: [
    {
      clue: "What machine do you use to keep milk cold?",
      target: "refrigerator",
      distractors: ["oven", "microwave", "blender"],
      hint: "It stands tall in the kitchen and has a cold door."
    },
    {
      clue: "What utensil do you use to slice bread?",
      target: "knife",
      distractors: ["spoon", "fork", "whisk"],
      hint: "It is sharp and used for cutting."
    }
  ]
};

// --- 2. STATE MANAGEMENT ---
let currentCategory = "important"; // Default category
let currentQuestionIndex = 0;
let isTextToSpeechEnabled = true;

// --- 3. DOM ELEMENTS ---
const elements = {
  onboardingOverlay: document.getElementById("onboarding-overlay"),
  btnStart: document.getElementById("btn-start"),

  emergencyOverlay: document.getElementById("emergency-overlay"),
  btnEmergencyTrigger: document.getElementById("btn-emergency-trigger"),
  btnResumeQuiz: document.getElementById("btn-resume-quiz"),
  btnAlertCaregiver: document.getElementById("btn-alert-caregiver"),

  celebrationOverlay: document.getElementById("celebration-overlay"),
  btnNextQuestion: document.getElementById("btn-next-question"),
  celebrationFeedback: document.getElementById("celebration-feedback"),

  clueDisplay: document.getElementById("clue-display"),
  btnSpeakClue: document.getElementById("btn-speak-clue"),
  hintDisplay: document.getElementById("hint-display"),
  optionsContainer: document.getElementById("options-container"),

  navImportant: document.getElementById("nav-important"),
  navEveryday: document.getElementById("nav-everyday")
};

// --- 4. ACCESSIBLE SYNTHETIC AUDIO ENGINE ---
// Uses Web Audio API to synthesize smooth tones for validation feedback
const AudioEngine = {
  ctx: null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  playCorrect() {
    this.init();
    const now = this.ctx.currentTime;

    // Create ascending pleasant notes (C4, E4, G4, C5)
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0, now + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.35);
    });
  },

  playIncorrect() {
    this.init();
    const now = this.ctx.currentTime;

    // Play a low, soft warm dual-tone (E3 and C3)
    const notes = [164.81, 130.81];
    notes.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    });
  }
};

// --- 5. SPEECH SYNTHESIS ENGINE ---
// Reads clue questions out loud to assist recognition
function speakClueText(text) {
  if (!('speechSynthesis' in window)) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.85; // Speak slightly slower for clarity
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
}

// --- 6. CORE LOGIC & RENDERING ---

function getQuestions() {
  return QUIZ_DATABASE[currentCategory] || [];
}

function loadQuestion() {
  const questions = getQuestions();
  if (questions.length === 0) return;

  // Wrap index to handle looping
  if (currentQuestionIndex >= questions.length) {
    currentQuestionIndex = 0;
  }

  const currentQuestion = questions[currentQuestionIndex];

  // Update clue
  elements.clueDisplay.textContent = currentQuestion.clue;

  // Clear hints
  elements.hintDisplay.textContent = "";

  // Prepare answers (Target word + distractors shuffled)
  const answers = [
    { text: currentQuestion.target, isTarget: true },
    ...currentQuestion.distractors.map(d => ({ text: d, isTarget: false }))
  ];

  // Accessible shuffle implementation
  answers.sort(() => Math.random() - 0.5);

  // Render options
  elements.optionsContainer.innerHTML = "";
  answers.forEach((ans, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = ans.text;
    btn.setAttribute("aria-label", `Option ${idx + 1}: ${ans.text}`);

    btn.addEventListener("click", () => handleSelection(btn, ans.isTarget, currentQuestion.target, currentQuestion.hint));
    elements.optionsContainer.appendChild(btn);
  });

  // Automatically read clue aloud if preferred (and onboarding is done)
  if (isTextToSpeechEnabled && !elements.onboardingOverlay.classList.contains("active")) {
    // Delay slightly to prevent overlap with transition effects
    setTimeout(() => speakClueText(currentQuestion.clue), 500);
  }
}

function handleSelection(buttonElement, isTarget, targetValue, hintText) {
  if (isTarget) {
    // 1. Success validation
    AudioEngine.playCorrect();

    // 2. Play celebration speech
    if (isTextToSpeechEnabled) {
      speakClueText(`Correct! The answer is ${targetValue}. Excellent job.`);
    }

    // 3. Show Celebration modal
    elements.celebrationFeedback.innerHTML = `You correctly remembered: <strong>${targetValue}</strong>`;
    elements.celebrationOverlay.classList.add("active");
  } else {
    // 1. Failure warning tone
    AudioEngine.playIncorrect();

    // 2. Gentle grey out button
    buttonElement.classList.add("incorrect");
    buttonElement.setAttribute("disabled", "true");

    // 3. Show gentle text hint
    elements.hintDisplay.textContent = hintText;

    // 4. Optionally read hint aloud
    if (isTextToSpeechEnabled) {
      speakClueText(hintText);
    }
  }
}

// --- 7. EVENT LISTENERS ---

// Onboarding Dismissal
elements.btnStart.addEventListener("click", () => {
  elements.onboardingOverlay.classList.remove("active");

  // Initialize context on user click
  AudioEngine.init();

  // Initial load
  loadQuestion();
});

// Emergency Trigger & Intercept Flow
elements.btnEmergencyTrigger.addEventListener("click", () => {
  // Pause any speaking
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  elements.emergencyOverlay.classList.add("active");
});

elements.btnResumeQuiz.addEventListener("click", () => {
  elements.emergencyOverlay.classList.remove("active");
});

// Alert Caregiver Flow (Mock demonstration)
elements.btnAlertCaregiver.addEventListener("click", () => {
  elements.btnAlertCaregiver.style.background = "#059669";
  elements.btnAlertCaregiver.querySelector(".btn-text-large").textContent = "Caregiver Notified";
  elements.btnAlertCaregiver.querySelector(".btn-text-small").textContent = "A distress notification was simulated.";

  setTimeout(() => {
    elements.btnAlertCaregiver.style.background = "";
    elements.btnAlertCaregiver.querySelector(".btn-text-large").textContent = "Alert Primary Caregiver";
    elements.btnAlertCaregiver.querySelector(".btn-text-small").textContent = "Send urgent distress notice";
  }, 4000);
});

// Next Question Trigger
elements.btnNextQuestion.addEventListener("click", () => {
  elements.celebrationOverlay.classList.remove("active");
  currentQuestionIndex++;
  loadQuestion();
});

// Clue Speaker Button Trigger
elements.btnSpeakClue.addEventListener("click", () => {
  const currentClue = elements.clueDisplay.textContent;
  speakClueText(currentClue);
});

// Category Switch Tab Controls
elements.navImportant.addEventListener("click", () => {
  if (currentCategory === "important") return;
  currentCategory = "important";
  currentQuestionIndex = 0;

  elements.navImportant.classList.add("active");
  elements.navEveryday.classList.remove("active");

  loadQuestion();
});

elements.navEveryday.addEventListener("click", () => {
  if (currentCategory === "everyday") return;
  currentCategory = "everyday";
  currentQuestionIndex = 0;

  elements.navEveryday.classList.add("active");
  elements.navImportant.classList.remove("active");

  loadQuestion();
});

// Initialize on page load (Wait for user click to trigger speech & sound to satisfy browsers)
window.addEventListener("DOMContentLoaded", () => {
  // Setup loading state
  elements.clueDisplay.textContent = "Please read the disclaimer to start.";
});
