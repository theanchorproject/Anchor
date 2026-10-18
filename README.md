# ⚓ Anchor
**A Semantic Interface for Memory Care Patients**

[![Status](https://img.shields.io/badge/Status-V1_Live-success.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**🟢 [Live Demo: Github Pages](https://theanchorproject.github.io/Anchor/)**

## About the Project
Anchor is a lightweight web application designed to assist individuals experiencing early-stage cognitive decline. Inspired by a family member's dementia diagnosis, this project diverges from traditional passive dementia tech (like GPS trackers) by focusing on **active cognitive assistance**. 

Using active recall exercises, Anchor helps patients counteract daily memory gaps and retain crucial personal and everyday information. The interface is meticulously designed for high visual accessibility and ease of use, ensuring it remains intuitive for both patients and their caregivers.
***
## Core Features
* **High-Accessibility UI:** Minimalist design, large high-contrast target buttons, and a clean bottom navigation bar.
* **Important Information Mode:** Caregivers can populate custom active-recall flashcards (e.g., "What is your oldest son's name?") via a secure administrative portal.
* **Everyday Information Mode:** Tests memory retrieval for common household items and vocabulary.
* **Audio Assistance:** Built-in Text-to-Speech (TTS) integration reads clues aloud to assist visually impaired patients.
* **Positive Feedback Loop:** Incorrect guesses gently grey out with helpful hints rather than aggressive "fail" states, while correct answers trigger positive reinforcement overlays.
* **Emergency Intercept:** A persistent "HELP" trigger that immediately pauses the app and provides 1-tap buttons to call 911 or alert a primary caregiver.
* **Strict Medical Disclaimer:** Clear onboarding explicitly stating the tool is for cognitive assistance, not medical diagnosis.
***
## Technical Architecture & Stack
Anchor is built with a decoupled architecture, prioritizing a lightweight client and a secure, isolated backend.

* **Frontend:** Vanilla HTML5, CSS3, and JavaScript (`app.js`). Hosted globally via **GitHub Pages**.
* **Database:** **Supabase (PostgreSQL)**. 
  * Features two primary tables: `everyday_vocabulary` and `important_info`.
  * Secured via strictly configured Row Level Security (RLS) policies allowing `anon` read access.
* **Caregiver Admin Portal:** **Retool**. A connected administrative dashboard allowing caregivers to input prompts, targets, hints, and distractors, sending data directly to the Supabase backend.
* **Development Environment:** Google Antigravity IDE.
***
### Data Flow
1. **Caregiver Input:** Caregivers log into the Retool dashboard to create custom questions.
2. **Database Storage:** Retool securely `INSERT`s the data into the Supabase PostgreSQL database.
3. **Patient Retrieval:** The Anchor frontend fetches the data via Supabase's JS Client using read-only public RLS policies.
***
## Local Development Setup
To run this project locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/theanchorproject/Anchor.git
   ```
2. Navigate to the project directory:
   ```bash
   cd Anchor
   ```
3. Open `index.html` in any modern web browser or run via a local live server.
***
## Phase 2 Roadmap
With Version 1 deployed, the following features are planned for subsequent releases:

1. **AI Engine Integration:** Connect OpenAI's API via a secure Supabase Edge Function to dynamically generate plausible, categorized distractors for the Everyday Information mode based on strict system prompts.
2. **Spaced Repetition (SM-2 Algorithm):** Implement local storage tracking to schedule difficult words to reappear at mathematically optimized intervals (1, 3, 7 days) to reinforce fading neural pathways.
***
## License & Disclaimer
This project is licensed under the MIT License. 

**Medical Disclaimer:** Anchor is a cognitive assistance tool designed to support active recall. It is not diagnostic, medical, or clinical software, and should not be used as a substitute for professional medical advice, diagnosis, or treatment.