let conversationHistory = [];
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let uploadedImageBase64 = null;

// API Configuration - Replace with your Render URL
const API_BASE_URL = "https://vitalsync-kdtc.onrender.com";

// ========== NEURAL CANVAS BACKGROUND ==========
(function initNeuralCanvas() {
    const canvas = document.getElementById('neuralCanvas');
    const ctx = canvas.getContext('2d');
    let nodes = [];
    const NODE_COUNT = 60;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            r: Math.random() * 2 + 1
        });
    }

    function drawCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 130) {
                    ctx.beginPath();
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.strokeStyle = `rgba(99,102,241,${0.18 * (1 - dist / 130)})`;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                }
            }
        }

        // Draw nodes
        nodes.forEach(n => {
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(99,102,241,0.55)';
            ctx.fill();

            n.x += n.vx;
            n.y += n.vy;
            if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
            if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        });

        requestAnimationFrame(drawCanvas);
    }
    drawCanvas();
})();

// ========== SETTINGS PANEL ==========
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.classList.toggle('open');
}

function toggleTheme() {
    const body = document.body;
    if (body.classList.contains('dark-mode')) {
        body.classList.replace('dark-mode', 'light-mode');
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.replace('light-mode', 'dark-mode');
        localStorage.setItem('theme', 'dark');
    }
}
// Alias for settings panel button
function toggleDarkMode() { toggleTheme(); }

function updatePersonalization() {
    // Voice feedback preference saved locally
    const voiceEnabled = document.getElementById('voiceEnabled').checked;
    localStorage.setItem('voiceEnabled', voiceEnabled);
}

// ========== CLEAR CHAT ==========
function clearChat() {
    const thread = document.getElementById('chatThread');
    thread.innerHTML = `
        <div class="ai-message">
            <div class="message-icon">🤖</div>
            <div class="message-content">
                Welcome to Neural Health AI. Please describe your symptoms in detail. You can also upload a medical image or use the microphone to speak.
            </div>
        </div>`;
    conversationHistory = [];
    uploadedImageBase64 = null;
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('symptoms').value = '';
}

// ========== TEXTAREA AUTO RESIZE ==========
function onUserType() {
    const ta = document.getElementById('symptoms');
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
}

// ========== TEMPERATURE INDICATOR ==========
function updateTempIndicator(val) {
    const indicator = document.getElementById('tempIndicator');
    const v = parseFloat(val);
    if (!v) { indicator.textContent = '—'; indicator.className = 'temp-indicator'; return; }
    if (v < 36.1) { indicator.textContent = 'Low'; indicator.className = 'temp-indicator temp-low'; }
    else if (v <= 37.5) { indicator.textContent = 'Normal'; indicator.className = 'temp-indicator temp-normal'; }
    else if (v <= 38.5) { indicator.textContent = 'Elevated'; indicator.className = 'temp-indicator temp-elevated'; }
    else { indicator.textContent = 'Fever'; indicator.className = 'temp-indicator temp-fever'; }
}

// ========== PAIN SEVERITY SLIDER ==========
function updateSeverity(val) {
    document.getElementById('severityValue').textContent = val;
    const labels = ['', 'Minimal', 'Mild', 'Mild', 'Moderate', 'Moderate', 'Moderate', 'Severe', 'Severe', 'Intense', 'Extreme'];
    document.getElementById('severityLabel').textContent = labels[parseInt(val)] || '';
}

// ========== FILE UPLOAD / IMAGE PREVIEW ==========
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImageBase64 = e.target.result.split(',')[1];
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `
            <div class="preview-thumb">
                <img src="${e.target.result}" alt="Uploaded medical image">
                <button onclick="removeImage()" class="remove-img-btn" title="Remove">✕</button>
            </div>`;
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    uploadedImageBase64 = null;
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('fileInput').value = '';
}

// ========== VOICE RECORDING (UNTOUCHED BACKEND LOGIC) ==========
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

// ========== APPEND MESSAGE ==========
function appendMessage(role, text, predictions = null) {
    const thread = document.getElementById("chatThread");
    const msgDiv = document.createElement("div");
    msgDiv.className = role === "user" ? "user-message" : "ai-message";

    const formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    let diagHTML = '';
    if (predictions && predictions.length > 0) {
        diagHTML = `
            <div class="differential-box">
                <p class="diff-label">Differential Diagnosis</p>
                ${predictions.map(p => `
                    <div class="diff-item">
                        <span>${p.condition}</span>
                        <span class="diff-confidence">${p.confidence}</span>
                    </div>
                `).join('')}
            </div>`;
    }

    msgDiv.innerHTML = `
        <div class="message-icon">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-content">${formattedText}${diagHTML}</div>`;
    thread.appendChild(msgDiv);
    thread.scrollTop = thread.scrollHeight;
}

// ========== MAIN SCAN (UNTOUCHED BACKEND CALLS) ==========
async function initiateScan() {
    const textarea = document.getElementById("symptoms");
    const textInput = textarea.value.trim();
    if (!textInput) return;

    // Build context with vitals if filled
    const temp = document.getElementById('temperature').value;
    const severity = document.getElementById('severity').value;
    let enrichedText = textInput;
    if (temp) enrichedText += ` [Temperature: ${temp}°C]`;
    if (severity) enrichedText += ` [Pain severity: ${severity}/10]`;

    appendMessage("user", textInput);
    textarea.value = "";
    textarea.style.height = 'auto';

    const thinkingId = "thinking-" + Date.now();
    const thread = document.getElementById("chatThread");
    const thinkingDiv = document.createElement("div");
    thinkingDiv.className = "ai-message";
    thinkingDiv.id = thinkingId;
    thinkingDiv.innerHTML = `<div class="message-icon">🤖</div><div class="message-content thinking-msg">VitalSync is analyzing<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></div>`;
    thread.appendChild(thinkingDiv);
    thread.scrollTop = thread.scrollHeight;

    try {
        const res = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: enrichedText })
        });
        const data = await res.json();
        document.getElementById(thinkingId).remove();
        appendMessage("ai", data.doctor_note, data.top_predictions);
        // Track history
        conversationHistory.push({ role: 'user', content: textInput });
        conversationHistory.push({ role: 'assistant', content: data.doctor_note });
    } catch (error) {
        const el = document.getElementById(thinkingId);
        if (el) el.innerHTML = `<div class="message-icon">🤖</div><div class="message-content">⚠️ System unreachable. Check connection.</div>`;
    }
}

// ========== KEYBOARD SHORTCUT: ENTER TO SEND ==========
document.addEventListener('DOMContentLoaded', () => {
    // Restore saved theme
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
        document.body.classList.replace('dark-mode', 'light-mode');
    }

    // Enter to submit
    const ta = document.getElementById('symptoms');
    if (ta) {
        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                initiateScan();
            }
        });
    }
    // Init severity label
    updateSeverity(document.getElementById('severity').value);
});