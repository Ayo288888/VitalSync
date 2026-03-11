# VitalSync: Multi-Modal AI Triage Engine 🩺

VitalSync is an intelligent, patient-facing self-triage system designed to bridge the gap between initial symptom onset and professional medical care. 

Moving beyond standard symptom checkers, VitalSync utilizes a **Multi-Agent Hybrid Architecture**. It orchestrates a custom-trained local classification model with state-of-the-art Cloud LLMs to provide users with immediate, highly structured, and empathetic health guidance without requiring heavy server infrastructure.



## 🚀 Engineering Highlights

* **Multi-Agent Orchestration:** Processes patient input locally using a custom Hugging Face neural network (`Iloriayomide/Symptom_Prediction`) for rapid baseline medical classification, then pipes those tensor outputs to Google's Gemini for natural language clinical reasoning.
* **Fault-Tolerant Waterfall Fallback:** Engineered for high availability. The system defaults to the bleeding-edge **Gemini 3 Flash** engine. If the API hits a rate limit (HTTP 429), it silently catches the exception and routes the request to a fallback model with zero downtime for the user.
* **Multi-Modal Voice Processing:** Integrates Groq's `whisper-large-v3` model, allowing patients to dictate their symptoms via audio. The system handles the transcription and triage in milliseconds.
* **Patient-Centric UI Injection:** The Cloud Agent is strictly prompted to return semantic HTML (rather than raw Markdown) to ensure the frontend instantly renders a beautiful, accessible care plan, including step-by-step home relief and Emergency Red Flags.

## 🧠 The Tech Stack

* **Core Backend:** FastAPI, Python, Uvicorn (Asynchronous REST framework)
* **Local Intelligence:** Hugging Face `transformers`, PyTorch
* **Cloud Intelligence:** Google GenAI SDK (`gemini-3-flash-preview`), Groq Cloud API
* **Security & Configuration:** `python-dotenv` for strict environment variable isolation
