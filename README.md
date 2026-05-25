# CurioKids AI 🎒✨

**An AI-powered learning adventure platform for children aged 3–8.**

CurioKids AI blends toy-like glassmorphic layouts, wobbly micro-animations, and interactive cartoon worlds with AI tracking — making learning genuinely fun for little ones.

🌐 **[Live Demo → curio-kids-ai.vercel.app](https://curio-kids-ai.vercel.app)**

---

## 🎮 Playroom Games

Four interactive, gamified modules that track stars, flame streaks, and cognitive stats:

**🧩 Memory Match** — Flip and match adorable cartoon animal pairs on a wobbly 3D card grid. Awards points for matches and full deck clears.

**🗣️ Word Repeat** — Listen to your companion mascot read a word, then repeat it into your microphone using the Web Speech Recognition API. Earn streak bonuses for consecutive perfect pronunciations!

**✨ AirDraw Adventure** — Pinch your fingers in the air to draw shapes (circle, square, triangle, heart, star) on a camera canvas. Paths are classified in real-time using contour matching.

**🎈 Alphabet Grab** — Catch floating letter balloons by pinching in front of the camera, then drop them into a cute hungry monster to solve alphabet puzzles!

---

## 🦊 Companion Mascot System

Responsive vector-animated companions guide kids, react emotionally to inputs, and speak in floating speech bubbles:

- **Sparky Fox** 🦊 — Your energetic default guide. Winks, waves, and celebrates!
- **Rocky Dino** 🦖 — Unlocks at Level 3.
- **Ziggy Jelly** 👽 — A three-eyed alien buddy. Unlocks at Level 5.

---

## 📈 Parent Dashboard

A password-protected station for parents to review progress:

- **Cognitive Skill Radar** — Spider graph tracking Vocabulary, Memory, Hand Coordination, Pronunciation, and Focus.
- **Daily Stars Timeline** — Weekly star accumulation trends.
- **🎖️ PDF Report Card Exporter** — Generates printable progress cards with streak logs, star metrics, and educational tips via `jsPDF`.

---

## 🛠️ Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React + Vite, Tailwind CSS, Framer Motion |
| AI / Vision | MediaPipe Hands, Web Speech API |
| Auth & DB | Firebase Auth + Cloud Firestore |
| Backend | Firebase Functions, Flask (Python) |
| PDF Export | jsPDF + html2canvas |
| Hosting | Vercel |

---

*Made with 💖 for young learners.*
