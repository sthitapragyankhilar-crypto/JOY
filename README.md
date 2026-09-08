# 🎙️ JOY - RAG-Powered AI Podcaster Voice Agent

An end-to-end, 100% free and open-source **AI Voice Agent** engineered specifically to interview resource persons, keynote speakers, and conference guests like a seasoned podcast host.

The agent features **Retrieval-Augmented Generation (RAG)** for factual grounding on guest documents, **real-time logical reasoning**, **chain-of-thought analysis**, **dynamic follow-up question generation**, and **neural speech synthesis**.

---

## 🌟 Key Features

1. **End-to-End Voice Interaction**: Speech input from conference guests and hyper-realistic Text-to-Speech host output.
2. **Logical Reasoning & Chain-of-Thought**: Before speaking, the AI host executes explicit internal reasoning (`<think>` steps) to analyze the guest's points, evaluate trade-offs, check the agenda, and formulate sharp follow-ups.
3. **RAG-Powered Knowledge Base**: Upload guest documents and publications with **per-guest document tagging**. The agent uses in-memory semantic search to ground its questions in the guest's actual work.
4. **Multi-Guest & Multi-Persona Support**: Track multiple guests and active speakers in real-time. Switch between diverse AI Host personas (Alex, Elena, Marcus) with unique interviewing styles.
5. **Immersive 3D Visualizer**: Features a stunning, interactive 3D particle and waveform visualizer built with Three.js and Framer Motion.
6. **Continuous Learning Buffer**: Automatically tracks podcast history and spoken turns.
7. **Flexible LLM Backends**: Operates using local open-source models (Ollama) or fast cloud inference APIs (Groq).

---

## 📐 System Architecture

```
                       🎙️ GUEST VOICE INPUT (Microphone)
                                      │
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       Speech-to-Text (STT) Processing           │
             │   - Web Speech API (Browser Native Zero-Cost)   │
             │   - OR Faster-Whisper (Local Python Backend)    │
             └────────────────────────┬────────────────────────┘
                                      │ Transcribed Text
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │          Context Memory & RAG Indexer           │
             │   - TF-IDF Semantic Search over Guest Docs      │
             │   - Podcast History / Continuous Buffer         │
             └────────────────────────┬────────────────────────┘
                                      │ Context & History
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │    Logical Reasoning Engine ("The Brain")       │
             │  Runs Chain-of-Thought inside <think> tags:     │
             │  1. Analyze intent and synthesize RAG context   │
             │  2. Formulate podcast response & follow-ups     │
             │                                                 │
             │  Engines: Ollama (Llama3.2/DeepSeek-R1)         │
             │           Groq API (Qwen3.6-27b)                │
             └────────────────────────┬────────────────────────┘
                                      │ Host Response Text
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │         Text-to-Speech (TTS) Engine             │
             │   - Edge-TTS (Microsoft Neural Voice Backend)   │
             └────────────────────────┬────────────────────────┘
                                      │
                                      ▼
                      🔊 AI HOST AUDIO PLAYBACK & 3D WAVEFORM
```

---

## 🛠️ Tools & Technologies Used

| Layer | Tool / Technology | License / Cost | Why Selected? |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | React + Vite + Custom CSS | MIT (Free) | High-performance, low-latency UI. |
| **3D & Animation** | Three.js (`@react-three/fiber`) + Framer Motion | MIT (Free) | Immersive glassmorphism and real-time particle audio visualizers. |
| **Backend API** | Python FastAPI + Asyncio | MIT (Free) | Asynchronous backend orchestration for RAG, reasoning, and TTS generation. |
| **RAG System** | In-Memory TF-IDF Vector Search | Free | Fast, zero-dependency semantic search for guest knowledge chunks. |
| **LLM Engine** | Ollama (`llama3.2` / `deepseek-r1:8b`) / Groq API (`qwen/qwen3.6-27b`) | Open Weight / Free / API | Enables structured reasoning loops and rich podcast host roleplay with multi-persona support. |
| **TTS Engine** | Edge-TTS (Microsoft Neural) | Free | Free neural voice synthesis producing natural intonations suitable for broadcast podcasting. |

---

## 🚀 Quick Start Guide

### 1. Local Python Backend with Ollama or Groq

1. **Environment Setup (Optional for Groq/ngrok)**:
   Create a `.env` file in the root directory to store your API keys if you plan to use Groq or ngrok:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   NGROK_AUTH_TOKEN=your_ngrok_auth_token_here
   ```

2. **Install Ollama (Optional for local inference)**:
   Download Ollama from [ollama.com](https://ollama.com) and pull a reasoning model:
   ```bash
   ollama pull llama3.2
   # or for DeepSeek reasoning:
   ollama pull deepseek-r1:8b
   ```

3. **Set up Python Virtual Environment**:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Start FastAPI Backend**:
   ```bash
   python main.py
   ```
   The backend server will run on `http://localhost:8000`.

### 2. Web Podcast Studio (Frontend)

1. **Install Dependencies**:
   Open a new terminal window:
   ```bash
   npm install
   ```

2. **Launch Studio UI**:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in Google Chrome or Microsoft Edge.
4. Configure the studio settings to use the Local backend (`http://localhost:8000`), upload knowledge documents, and start the podcast!

---

## 💡 Prompt Engineering & Chain-of-Thought Design

The core intelligence of the podcaster host lies in enforcing a **Thinking Step** before generating the spoken response. Here is the system prompt blueprint used by the agent (JOY):

```text
You are JOY, an intelligent, RAG-powered AI podcast interviewer hosting a technology conference session.
Your goal is to conduct an articulate, context-aware interview with the guest.

REASONING INSTRUCTIONS:
Before writing your verbal response, write a <think>...</think> block:
1. Intent Analysis: Determine if the guest asked a mic/status check ('can you hear me?'), a short query, or gave a technical answer.
2. Synthesize RAG Context: Incorporate any retrieved facts about the guest's uploaded publications/bio.
3. Formulate Podcast Response: Respond directly to what they said, then ask a context-rich follow-up question.

FORMAT REQUIRED:
<think>
[Analytical thoughts...]
</think>
[JOY's spoken podcast response]
```

This format ensures that the AI host never gives generic "IA assistant" replies, but instead acts like a professional interviewer actively analyzing the guest's insights using retrieved RAG facts!

---

## 🤝 For Collaborators

If you want to contribute to this project or run the code on your own machine without setting up the heavy Python backend, you can connect your local frontend directly to the hosted Render backend!

1. **Fork and Clone** this repository.
2. **Rename `.env.example` to `.env`** and add your own Groq API key.
3. **Point to the Hosted Backend**: Inside your new `.env` file, add the following line with the live Render URL:
   ```env
   VITE_BACKEND_URL=https://your-joy-backend.onrender.com
   ```
4. **Run the UI**: 
   ```bash
   npm install
   npm run dev
   ```
Now, any code changes you make to the React UI on your local machine will automatically communicate with the live Render AI backend over the internet!
