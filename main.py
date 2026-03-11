import os
import re
from fastapi import FastAPI, HTTPException, File, UploadFile
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from google import genai
from google.genai import errors
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Allow both local testing and your production Vercel URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CLOUD CLIENTS ---
gemini_key = os.getenv("GEMINI_API_KEY")
groq_key = os.getenv("GROQ_API_KEY")

client = genai.Client(api_key=gemini_key)
groq_client = Groq(api_key=groq_key)

class SymptomRequest(BaseModel):
    text: str

def perform_cloud_triage(raw_text: str):
    """
    Orchestrates Gemini to perform structured classification 
    and patient-friendly care planning.
    """
    prompt = (
        f"USER SYMPTOMS: {raw_text}\n\n"
        "ACT AS: A Senior Diagnostic AI and Clinical Orchestrator.\n"
        "TASK 1: Identify the 3 most likely medical conditions (Differential Diagnosis).\n"
        "TASK 2: Assign a percentage confidence score to each (must total 100% or less).\n"
        "TASK 3: Provide patient-friendly care instructions in HTML.\n\n"
        "CRITICAL FORMATTING: You must return the output in two distinct parts.\n"
        "PART 1 (PREDICTIONS): Start your response with a line exactly like this:\n"
        "PREDICTIONS: [Condition 1|85%], [Condition 2|10%], [Condition 3|5%]\n\n"
        "PART 2 (CARE PLAN): Follow with this HTML structure:\n"
        "<h4>🩺 Assessment</h4><p>[Explain top condition]</p>\n"
        "<h4>🩹 Immediate Relief</h4><ul><li>[Step 1]</li></ul>\n"
        "<h4>💊 Pharmacy Advice</h4><p>[OTC suggestions]</p>\n"
        "<h4>🚨 RED FLAGS</h4><ul><li>[Warning sign]</li></ul>\n"
        "<hr><p><small><em>DISCLAIMER: This is an AI tool and not a substitute for a doctor.</em></small></p>"
    )

    try:
        # Primary: Gemini 3 Flash
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt
        )
    except errors.ClientError as e:
        if e.code == 429:
            # Fallback: Gemini 2.5 Flash
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
        else:
            raise e

    full_text = response.text
    predictions = []
    doctor_note = full_text

    # Regex to extract the "PREDICTIONS" line for the UI
    pred_match = re.search(r"PREDICTIONS: (.*)", full_text)
    if pred_match:
        raw_preds = pred_match.group(1).strip()
        # Parse [Condition|Score] segments
        segments = re.findall(r"\[(.*?)\|(.*?)\]", raw_preds)
        for name, conf in segments:
            predictions.append({"condition": name.strip(), "confidence": conf.strip()})
        
        # Strip the PREDICTIONS line from the final UI output
        doctor_note = re.sub(r"PREDICTIONS:.*", "", full_text).strip()

    return predictions, doctor_note

@app.post("/predict")
def predict_text(request: SymptomRequest):
    try:
        predictions, note = perform_cloud_triage(request.text)
        return {"top_predictions": predictions, "doctor_note": note, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/voice")
async def predict_voice(file: UploadFile = File(...)):
    try:
        audio_bytes = await file.read()
        transcription = groq_client.audio.transcriptions.create(
            file=("audio.wav", audio_bytes),
            model="whisper-large-v3",
        )
        predictions, note = perform_cloud_triage(transcription.text)
        return {"transcription": transcription.text, "top_predictions": predictions, "doctor_note": note}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)