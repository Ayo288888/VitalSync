let conversationHistory = [];
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

// API Configuration - Replace with your Render URL
const API_BASE_URL = "https://vitalsync-kdtc.onrender.com";

async function toggleRecording() {
    const micBtn = document.getElementById('micBtn');
    const micIcon = document.getElementById('micIcon');

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                await sendVoiceData(audioBlob);
            };
            mediaRecorder.start();
            isRecording = true;
            micIcon.textContent = '🛑';
            micBtn.classList.add('recording-pulse');
        } catch (err) { alert('Microphone access denied.'); }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        micIcon.textContent = '🎤';
        micBtn.classList.remove('recording-pulse');
    }
}

async function sendVoiceData(blob) {
    const formData = new FormData();
    formData.append('file', blob, 'audio.wav');
    appendMessage("ai", "Transcribing voice... 🎙️");
    try {
        const res = await fetch(`${API_BASE_URL}/predict/voice`, { method: 'POST', body: formData });
        const data = await res.json();
        document.getElementById("symptoms").value = data.transcription;
        initiateScan();
    } catch (e) { appendMessage("ai", "⚠️ Voice engine failed."); }
}

function appendMessage(role, text, predictions = null) {
    const thread = document.getElementById("chatThread");
    const msgDiv = document.createElement("div");
    msgDiv.className = role === "user" ? "user-message" : "ai-message";
    
    // Format LLM output (Markdown fallback + HTML)
    const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    let diagHTML = '';
    if (predictions && predictions.length > 0) {
        diagHTML = `
            <div class="differential-box" style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                <p style="font-size:0.7rem; opacity:0.6; text-transform:uppercase;">Differential Diagnosis</p>
                ${predictions.map(p => `
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-top:5px;">
                        <span>${p.condition}</span>
                        <span style="color:#6366f1; font-weight:700;">${p.confidence}</span>
                    </div>
                `).join('')}
            </div>`;
    }

    msgDiv.innerHTML = `<div class="message-icon">${role === 'user' ? '👤' : '🤖'}</div>
                        <div class="message-content">${formattedText}${diagHTML}</div>`;
    thread.appendChild(msgDiv);
    thread.scrollTop = thread.scrollHeight;
}

async function initiateScan() {
    const textarea = document.getElementById("symptoms");
    const textInput = textarea.value.trim();
    if (!textInput) return;

    appendMessage("user", textInput);
    textarea.value = "";
    
    const thinkingId = "thinking-" + Date.now();
    const thread = document.getElementById("chatThread");
    const thinkingDiv = document.createElement("div");
    thinkingDiv.className = "ai-message";
    thinkingDiv.id = thinkingId;
    thinkingDiv.innerHTML = `<div class="message-icon">🤖</div><div class="message-content">VitalSync is analyzing... <span class="loading-dots">...</span></div>`;
    thread.appendChild(thinkingDiv);

    try {
        const res = await fetch(`${API_BASE_URL}/predict`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textInput }) 
        });
        const data = await res.json();
        document.getElementById(thinkingId).remove();
        appendMessage("ai", data.doctor_note, data.top_predictions);
    } catch (error) {
        document.getElementById(thinkingId).innerHTML = `⚠️ System unreachable. Check connection.`;
    }
}