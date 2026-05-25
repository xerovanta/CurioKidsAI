from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="CurioKids AI Backend", description="Adaptive Learning Analytics Services")

# Allow requests from local frontend port (3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pydantic import BaseModel
from typing import List, Optional

class TelemetryPayload(BaseModel):
    accuracy: Optional[float] = 0.75
    speedSeconds: Optional[float] = 8.0
    emotions: Optional[List[str]] = ["neutral"]

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "CurioKids AI Backend API",
        "version": "0.1.0"
    }

@app.post("/api/adaptive-lesson")
def get_adaptive_lesson(payload: TelemetryPayload):
    accuracy = payload.accuracy
    speed = payload.speedSeconds
    emotions = payload.emotions
    
    safe_emotions = emotions if emotions else ["neutral"]
    total = len(safe_emotions)
    active = sum(1 for e in safe_emotions if e in ["happy", "surprised", "neutral"])
    focus_score = round(active / total, 2)
    
    difficulty = "STANDARD"
    next_lesson = "Color Hunt (Standard)"
    colors_pool = ["red", "green", "blue", "yellow", "orange", "purple"]
    shapes_pool = ["circle", "triangle", "square"]
    hint_interval = 5000
    
    if accuracy >= 0.90 and focus_score >= 0.75:
        difficulty = "EXPERT"
        next_lesson = "Color Hunt (Expert)"
        colors_pool = ["crimson", "turquoise", "lime", "coral", "fuchsia", "lavender"]
        hint_interval = 8000
    elif accuracy <= 0.60 or focus_score <= 0.50:
        difficulty = "BEGINNER"
        next_lesson = "Shape Detective (Beginner)"
        colors_pool = ["red", "green", "blue", "yellow"]
        shapes_pool = ["circle"]
        hint_interval = 3000
        
    buddy_state = "idle"
    motivation = "Let's hunt for colors together! You can do it! 📐"
    
    if focus_score < 0.60:
        buddy_state = "listening"
        motivation = "💡 Psst! I'm waving! Try holding it a bit closer to help me see! 🦊"
    elif "happy" in emotions:
        buddy_state = "happy"
        motivation = "🎉 Look at that big focus smile! We make an outstanding team! 🦖"
        
    return {
        "success": True,
        "difficulty": difficulty,
        "focusScore": int(focus_score * 100),
        "nextLesson": next_lesson,
        "colorsPool": colors_pool,
        "shapesPool": shapes_pool,
        "vocalHintInterval": hint_interval,
        "suggestedBuddyState": buddy_state,
        "companionMotivation": motivation
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
