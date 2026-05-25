# CurioKids AI 🎒✨

CurioKids AI is a visually stunning, emotionally engaging, and highly interactive **AI-powered learning adventure platform** designed specifically for children aged 3–8. The application blends modern, toy-like glassmorphic layouts, wobbly micro-animations, and interactive cartoon worlds with advanced artificial intelligence tracking capabilities.

---

## 🎮 The Active Playroom Games

The project features exactly four robust, highly interactive gamified modules that track stars progress, consecutive flame streaks, and cognitive statistics:

1. **🧩 Memory Match**
   * A classic spatial cognitive memory game. Flip and match adorable cartoon animal pairs on a wobbly 3D card grid. Awards points for card matching and complete deck clears.
2. **🗣️ Word Repeat**
   * A speech-recognition pronunciation module. Listen to your companion mascot read spelling words ("apple", "cat", "dog") and repeat them back into your microphone using the **Web Speech Recognition API**. Earn streak bonuses for consecutive perfect pronunciations!
3. **✨ AirDraw Adventure**
   * A camera-based computer vision canvas. Pinch your index finger and thumb in the air to draw shapes (circle, square, triangle, heart, star) directly on the screen. The path is classified in real-time using advanced **contour matching algorithms**!
4. **🎈 Alphabet Grab**
   * A balloon gesture tracking sandbox. Catch floating, bobbing letter balloons in the sky by pinching your fingers in front of the camera, and drop them cleanly into the mouth of a cute hungry monster to answer educational alphabet sequence puzzles!

---

## 🦊 The Companion Mascot System

A key feature of CurioKids AI is the responsive vector-animated companions that guide kids, react emotionally to correct/incorrect inputs, and speak aloud in floating speech capsules:
* **Sparky Fox**: Your default energetic orange guide, who winks, waves, and celebrates stars unlocks!
* **Rocky Dino** 🦖: A playful cyan little dinosaur companion (Unlocks automatically at **Level 3**!).
* **Ziggy Jelly** 👽: An energetic three-eyed alien jelly buddy from outer space (Unlocks automatically at **Level 5**!).

---

## 📈 Parent Command Station Dashboard

Parents have a password-protected lock gate to review kid progression:
* **Cognitive Skill Radar**: Interactive Recharts spider graph tracking **Vocabulary**, **Memory**, **Hand Coordination**, **Pronunciation**, and **Focus**.
* **Daily Stars Timeline**: Tracks weekly star accumulation trends.
* **Engagement Indicators**: Cross-references real-time focus states.
* **🎖️ PDF Report Card Exporter**: Automatically generates and downloads beautifully structured, printable pedagogical progress cards containing streak logs, star metrics, and custom educational tips using `jsPDF`.

---

## 🛠️ The Tech Stack

### Frontend & Client UI
* **Core**: React / Vite SPA
* **Styling**: Tailwind CSS & Vanilla custom HSL cartoon scenery variables
* **Animations**: Framer Motion & custom hardware-accelerated CSS keyframes
* **AI Computer Vision**: `@mediapipe/hands` (for high-fidelity finger gesture landmarks tracking)
* **Speech Synthesis & Recognition**: HTML5 SpeechSynthesis and SpeechRecognition APIs
* **Database & Auth**: Firebase Authentication & Cloud Firestore (supports automatic anonymous guest child logins)
* **PDF Exporters**: `jsPDF` & `html2canvas`

### Backend & Cloud Infrastructure
* **Framework**: Firebase Functions & Node.js
* **AI Utilities**: Flask (Python) backend setup for standalone microservices

---

## 🚀 Quick Start & Installation

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **npm** or **yarn**

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/xerovanta/CurioKidsAI.git
   cd CurioKidsAI
   ```

2. **Configure Environment Variables:**
   Create a `.env` file inside the `frontend/` directory (you can copy `frontend/.env.example` as a starting point) and add your Firebase API credentials.
   *(Note: The platform features a built-in sandbox sandbox fallback; if Firebase credentials are left blank, the app will run in **Offline/Mock Mode** so you can still fully explore the interface!).*

3. **Install Client Dependencies:**
   ```bash
   cd frontend
   npm install
   ```

4. **Launch Vite Local Server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:3000` to start your adventure!

5. **Build for Production:**
   ```bash
   npm run build
   ```

---

## 🌅 The Scenic Cartoon Environment
Every page of the application floats above a beautiful, animated cartoon landscape:
* Drifting cloud grids
* Rotating windmill sails
* Fluffy green foliage
* Perched blue bird bobbing
* Pulsing colorful fields flowers

*Made with 💖 for young learners.*
