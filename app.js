const supabaseUrl = "https://vfpzudsfoeikvumbfrsa.supabase.co";
const supabaseKey = "sb_publishable_cEHgw6agXxzK9dgjlSxErg_zF2PZH5J";

//create supabase
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

//first pull from db
async function getRandomTargetWord() {
  try {
    const { data, error } = await supabaseClient
      .from('everyday_vocabulary')
      .select('target_word, category');

    if (error) throw error;
    else console.log("success")

    return data;
  } catch (err) {
    console.error(err.message);
    return [];
  }
}

//first pull from db
async function getImportantInfo() {
  try {
    const { data, error } = await supabaseClient
      .from('important_info')
      .select('clue, target, hint, distractors');

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Failed to fetch important info:", err.message);
    return [];
  }
}

//placeholder data
const VOCABULARY_DETAILS = {
  toothbrush: {
    clue: "What do you use to clean your teeth every morning and night?",
    distractors: ["hairbrush", "soap", "towel"],
    hint: "It has bristles, and you apply toothpaste to it."
  },
  refrigerator: {
    clue: "What machine do you use to keep milk cold?",
    distractors: ["oven", "microwave", "blender"],
    hint: "It stands tall in the kitchen and has a cold door."
  },
  television: {
    clue: "What screen do you watch to see your favorite shows and news?",
    distractors: ["toaster", "radio", "washing machine"],
    hint: "It displays moving pictures and is controlled by a remote."
  }
};

//placeholder data


//misc
let currentCategory = "everyday";
let currentQuestionIndex = 0;
let isTextToSpeechEnabled = true;
let supabaseVocabulary = [];
let supabaseImportantInfo = [];

//elements
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

//chimes
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

//tts with elevenlabs API
async function speakClueText(text) {
  if (!isTextToSpeechEnabled) return;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/narrator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: text })
    });

    if (!response.ok) {
      throw new Error(`Edge Function failed with status ${response.status}`);
    }

    const audioBlob = await response.blob();
    
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();

  } catch (err) {
    console.error("High-quality TTS failed, falling back to robotic voice:", err);
    
    // fallback
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85; 
      window.speechSynthesis.speak(utterance);
    }
  }
}

function getFallbackDistractors(category, targetWord) {
  const sameCategory = supabaseVocabulary
    .filter(x => x.category === category && x.target_word !== targetWord)
    .map(x => x.target_word);

  if (sameCategory.length >= 3) {
    return sameCategory.slice(0, 3);
  }

  const allOtherWords = supabaseVocabulary
    .filter(x => x.target_word !== targetWord)
    .map(x => x.target_word);

  const pool = [...sameCategory, ...allOtherWords, "apple", "banana", "chair", "table", "clock"];
  const uniquePool = Array.from(new Set(pool)).filter(w => w !== targetWord);
  return uniquePool.slice(0, 3);
}

function getEverydayQuestion(item) {
  if (!item) return null;
  const word = item.target_word.toLowerCase();
  const details = VOCABULARY_DETAILS[word] || {
    clue: `What everyday item is this?`,
    distractors: getFallbackDistractors(item.category, item.target_word),
    hint: `It starts with the letter '${item.target_word[0].toUpperCase()}'.`
  };

  return {
    clue: details.clue,
    target: item.target_word,
    distractors: details.distractors,
    hint: details.hint
  };
}

function loadQuestion() {
  let currentQuestion = null;

  if (currentCategory === "important") {
    const questions = supabaseImportantInfo;

    if (questions.length === 0) {
      elements.clueDisplay.textContent = "Loading important information...";
      return;
    }

    if (currentQuestionIndex >= questions.length) {
      currentQuestionIndex = 0;
    }
    currentQuestion = questions[currentQuestionIndex]
  } else {
    if (currentQuestionIndex >= supabaseVocabulary.length) {
      currentQuestionIndex = 0;
    }
    const item = supabaseVocabulary[currentQuestionIndex];
    currentQuestion = getEverydayQuestion(item);
  }

  if (!currentQuestion) return;

  elements.clueDisplay.textContent = currentQuestion.clue;
  elements.hintDisplay.textContent = "";

  const answers = [
    { text: currentQuestion.target, isTarget: true },
    ...currentQuestion.distractors.map(d => ({ text: d, isTarget: false }))
  ];

  answers.sort(() => Math.random() - 0.5);

  elements.optionsContainer.innerHTML = "";
  answers.forEach((ans, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = ans.text;
    btn.setAttribute("aria-label", `Option ${idx + 1}: ${ans.text}`);

    btn.addEventListener("click", () => handleSelection(btn, ans.isTarget, currentQuestion.target, currentQuestion.hint));
    elements.optionsContainer.appendChild(btn);
  });

  if (isTextToSpeechEnabled && !elements.onboardingOverlay.classList.contains("active")) {
    setTimeout(() => speakClueText(currentQuestion.clue), 500);
  }
}

function handleSelection(buttonElement, isTarget, targetValue, hintText) {
  if (isTarget) {
    AudioEngine.playCorrect();
    if (isTextToSpeechEnabled) {
      speakClueText(`Correct! The answer is ${targetValue}. Excellent job.`);
    }

    elements.celebrationFeedback.innerHTML = `You correctly remembered: <strong>${targetValue}</strong>`;
    elements.celebrationOverlay.classList.add("active");
  } else {
    AudioEngine.playIncorrect();

    buttonElement.classList.add("incorrect");
    buttonElement.setAttribute("disabled", "true");

    elements.hintDisplay.textContent = hintText;

    if (isTextToSpeechEnabled) {
      speakClueText(hintText);
    }
  }
}

elements.btnStart.addEventListener("click", () => {
  elements.onboardingOverlay.classList.remove("active");
  AudioEngine.init();
  loadQuestion();
});

elements.btnEmergencyTrigger.addEventListener("click", () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  elements.emergencyOverlay.classList.add("active");
});

elements.btnResumeQuiz.addEventListener("click", () => {
  elements.emergencyOverlay.classList.remove("active");
});

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

elements.btnNextQuestion.addEventListener("click", () => {
  elements.celebrationOverlay.classList.remove("active");
  currentQuestionIndex++;
  loadQuestion();
});

elements.btnSpeakClue.addEventListener("click", () => {
  const currentClue = elements.clueDisplay.textContent;
  speakClueText(currentClue);
});

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

window.addEventListener("DOMContentLoaded", async () => {
  elements.clueDisplay.textContent = "Please read the disclaimer to start.";
  elements.navEveryday.classList.add("active");
  elements.navImportant.classList.remove("active");

  try {
    const vocabData = await getRandomTargetWord();
    if (vocabData && vocabData.length > 0) {
      supabaseVocabulary = vocabData.sort(() => Math.random() - 0.5);
    }
    
    const importantData = await getImportantInfo();
    if (importantData && importantData.length > 0) {
      supabaseImportantInfo = importantData.sort(() => Math.random() - 0.5);
    }
  } catch (err) {
    console.error(err);
  }
});

(function logAppVersion() {
  const version = "v0.03";
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  let environment = "pages";
  let badgeColor = "#0284c7";

  if (protocol === "file:") {
    environment = "filepath";
    badgeColor = "#dcca26ff";
  }
  else if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.")) {
    environment = "server";
    badgeColor = "#16a34a";
  }

  console.log(`ANCHOR ${version} running on ${environment}`);
})();