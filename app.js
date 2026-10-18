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

//second pull from db
async function getImportantInfo() {
  try {
    const { data, error } = await supabaseClient
      .from('important_info')
      .select('id, clue, target, hint, distractors, repetition_count, interval_days, ease_factor') 
      .lte('next_review_date', new Date().toISOString()); //'lte' means less than or equal to

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Failed to fetch important info:", err.message);
    return [];
  }
}

//sm2 algorithm
async function updateMemoryStrength(item, isCorrect) {
  let { id, repetition_count, interval_days, ease_factor } = item;

  // The SM-2 Math Logic
  if (isCorrect) {
    if (repetition_count === 0) {
      interval_days = 1;
    } else if (repetition_count === 1) {
      interval_days = 6;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetition_count += 1;
    ease_factor += 0.1; // Reward: increase the multiplier
  } else {
    repetition_count = 0;
    interval_days = 1; // Penalty: reset interval to tomorrow
    ease_factor = Math.max(1.3, ease_factor - 0.2); // Penalty: decrease multiplier, but never below 1.3
  }

  // Calculate the new future review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval_days);

  // Send the updated data back to Supabase
  try {
    await supabaseClient
      .from('important_info')
      .update({
        repetition_count: repetition_count,
        interval_days: interval_days,
        ease_factor: ease_factor,
        next_review_date: nextReviewDate.toISOString()
      })
      .eq('id', id);
  } catch (err) {
    console.error("Failed to save SM-2 data:", err.message);
  }
}

//misc
let currentCategory = "everyday";
let currentQuestionIndex = 0;
let isTextToSpeechEnabled = true;
let supabaseVocabulary = [];
let supabaseImportantInfo = [];
let currentAudioInstance = null;

//elements
const elements = {
  onboardingOverlay: document.getElementById("onboarding-overlay"),
  btnStart: document.getElementById("btn-start"),
  emergencyOverlay: document.getElementById("emergency-overlay"),
  btnEmergencyTrigger: document.getElementById("btn-emergency-trigger"),
  btnResumeQuiz: document.getElementById("btn-resume-quiz"),
  btnAlertCaregiver: document.getElementById("btn-alert-caregiver"),
  btnCall911: document.getElementById("btn-call-911"), // <-- ADD THIS LINE
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

  if (currentAudioInstance) {
    currentAudioInstance.pause();
    currentAudioInstance.currentTime = 0;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/narrator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: text })
    });

    if (!response.ok) throw new Error(`Edge Function failed: ${response.status}`);

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    currentAudioInstance = new Audio(audioUrl);
    const playPromise = currentAudioInstance.play();
    
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        if (error.name === 'AbortError') return;
        console.error("Audio playback error:", error);
      });
    }
  } catch (err) {
    console.error("High-quality TTS failed, falling back to robotic voice:", err);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85; 
      window.speechSynthesis.speak(utterance);
    }
  }
}

// gemini powered question/distractor fetcher
async function getEverydayQuestion(item) {
  if (!item) return null;
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/brain`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetWord: item.target_word,
        category: item.category
      })
    });

    if (!response.ok) throw new Error("Brain API failed");
    
    const aiData = await response.json();
    
    // AI models sometimes capitalize JSON keys. This catches all variations safely.
    const safeDistractors = aiData.distractors || aiData.Distractors || aiData.DISTRACTORS;
    
    return {
      clue: aiData.clue || aiData.Clue || `What item is this?`,
      target: item.target_word,
      // Guarantee it is an array before returning
      distractors: Array.isArray(safeDistractors) ? safeDistractors : ["apple", "chair", "clock"],
      hint: aiData.hint || aiData.Hint || `It starts with '${item.target_word[0].toUpperCase()}'.`
    };
  } catch (err) {
    console.error("AI Generation failed, using absolute fallback:", err);
    return {
      clue: `What everyday item is this?`,
      target: item.target_word || "Item",
      distractors: ["apple", "chair", "clock"],
      hint: `It starts with the letter '${(item.target_word || "A")[0].toUpperCase()}'.`
    };
  }
}

async function loadQuestion() {
  let currentQuestion = null;

  elements.optionsContainer.innerHTML = "";
  elements.hintDisplay.textContent = "";

  if (currentCategory === "important") {
    const questions = supabaseImportantInfo;

    if (questions.length === 0) {
      elements.clueDisplay.textContent = "Loading important information...";
      return;
    }

    if (currentQuestionIndex >= questions.length) {
      currentQuestionIndex = 0;
    }
    currentQuestion = questions[currentQuestionIndex];
  } else {
    elements.clueDisplay.textContent = "Generating next challenge...";
    
    if (currentQuestionIndex >= supabaseVocabulary.length) {
      currentQuestionIndex = 0;
    }
    const item = supabaseVocabulary[currentQuestionIndex];
    
    currentQuestion = await getEverydayQuestion(item);
  }

  if (!currentQuestion) return;

  elements.clueDisplay.textContent = currentQuestion.clue;

  const fallbackDistractors = ["apple", "banana", "clock"];
  const finalDistractors = Array.isArray(currentQuestion.distractors) 
    ? currentQuestion.distractors 
    : fallbackDistractors;

  const answers = [
    { text: currentQuestion.target || "Item", isTarget: true },
    ...finalDistractors.map(d => ({ text: d, isTarget: false }))
  ];

  answers.sort(() => Math.random() - 0.5);

  elements.optionsContainer.innerHTML = "";
  answers.forEach((ans, idx) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.textContent = ans.text;
    btn.setAttribute("aria-label", `Option ${idx + 1}: ${ans.text}`);

    btn.addEventListener("click", () => handleSelection(btn, ans.isTarget, currentQuestion));
    elements.optionsContainer.appendChild(btn);
  });

  if (isTextToSpeechEnabled && !elements.onboardingOverlay.classList.contains("active")) {
    setTimeout(() => speakClueText(currentQuestion.clue), 500);
  }
}

function handleSelection(buttonElement, isTarget, currentQuestion) {
  if (currentCategory === "important" && currentQuestion.id) {
    updateMemoryStrength(currentQuestion, isTarget);
  }

  if (isTarget) {
    AudioEngine.playCorrect();
    if (isTextToSpeechEnabled) {
      speakClueText(`Correct! The answer is ${currentQuestion.target}. Excellent job.`);
    }
    elements.celebrationFeedback.innerHTML = `You correctly remembered: <strong>${currentQuestion.target}</strong>`;
    elements.celebrationOverlay.classList.add("active");
  } else {
    AudioEngine.playIncorrect();
    buttonElement.classList.add("incorrect");
    buttonElement.setAttribute("disabled", "true");
    elements.hintDisplay.textContent = currentQuestion.hint;
    if (isTextToSpeechEnabled) {
      speakClueText(currentQuestion.hint);
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

const makeHoldToTrigger = (btnElement, actionCallback) => {
  let pressTimer;
  let countdownInterval;
  let isTriggered = false;
  let timeLeft = 3;

  const originalText = btnElement.querySelector(".btn-text-large").textContent;

  const startPress = (e) => {
    if (e.type === 'touchstart') e.preventDefault(); 
    isTriggered = false;
    timeLeft = 3;
    
    btnElement.classList.add("is-pressing");
    btnElement.querySelector(".btn-text-large").textContent = `Hold for ${timeLeft}...`;

    countdownInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        btnElement.querySelector(".btn-text-large").textContent = `Hold for ${timeLeft}...`;
      }
    }, 1000);

    pressTimer = setTimeout(() => {
      isTriggered = true;
      clearInterval(countdownInterval);
      btnElement.classList.remove("is-pressing");
      actionCallback();
    }, 3000);
  };

  const cancelPress = () => {
    if (isTriggered) return; 
    
    clearTimeout(pressTimer);
    clearInterval(countdownInterval);
    btnElement.classList.remove("is-pressing");
    btnElement.querySelector(".btn-text-large").textContent = originalText;
  };

  btnElement.addEventListener("mousedown", startPress);
  btnElement.addEventListener("touchstart", startPress, { passive: false });
  
  btnElement.addEventListener("mouseup", cancelPress);
  btnElement.addEventListener("mouseleave", cancelPress);
  btnElement.addEventListener("touchend", cancelPress);
  btnElement.addEventListener("touchcancel", cancelPress);
};

// 1. Wire up the Caregiver Pager Button
makeHoldToTrigger(elements.btnAlertCaregiver, async () => {
  const originalSub = elements.btnAlertCaregiver.querySelector(".btn-text-small").textContent;

  elements.btnAlertCaregiver.style.background = "#d97706";
  elements.btnAlertCaregiver.querySelector(".btn-text-large").textContent = "Sending SOS...";
  elements.btnAlertCaregiver.querySelector(".btn-text-small").textContent = "Connecting to network...";

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/pager`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetContact: "dev.theanchorproject@gmail.com", 
        patientName: "Grandma"
      })
    });

    if (!response.ok) throw new Error("Network response was not ok");

    elements.btnAlertCaregiver.style.background = "#059669"; 
    elements.btnAlertCaregiver.querySelector(".btn-text-large").textContent = "Caregiver Notified";
    elements.btnAlertCaregiver.querySelector(".btn-text-small").textContent = "SOS successfully delivered.";

  } catch (err) {
    console.error("Failed to trigger pager:", err);
    elements.btnAlertCaregiver.style.background = "#dc2626"; 
    elements.btnAlertCaregiver.querySelector(".btn-text-large").textContent = "Failed to Send";
    elements.btnAlertCaregiver.querySelector(".btn-text-small").textContent = "Network error. Please call 911.";
  }

  // Reset button visuals after 4 seconds
  setTimeout(() => {
    elements.btnAlertCaregiver.style.background = "";
    elements.btnAlertCaregiver.querySelector(".btn-text-large").textContent = "Alert Primary Caregiver";
    elements.btnAlertCaregiver.querySelector(".btn-text-small").textContent = originalSub;
  }, 4000);
});

// 2. Wire up the 911 Emergency Button
makeHoldToTrigger(elements.btnCall911, () => {
  elements.btnCall911.style.background = "#dc2626"; // Emergency red
  elements.btnCall911.querySelector(".btn-text-large").textContent = "Dialing 911...";
  
  // Trigger native phone dialer with 911 prepopulated
  window.location.href = "tel:911";

  // Reset text slightly after dialer opens
  setTimeout(() => {
    elements.btnCall911.style.background = "";
    elements.btnCall911.querySelector(".btn-text-large").textContent = "Call Emergency Services";
  }, 3000);
});

elements.btnNextQuestion.addEventListener("click", () => {
  if (currentAudioInstance) {
    currentAudioInstance.pause();
    currentAudioInstance.currentTime = 0;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

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
  const version = "v0.05";
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