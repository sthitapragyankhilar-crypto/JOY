# 🎙️ JOY - RAG-Powered AI Podcaster Voice Agent

An end-to-end **AI Voice Agent** engineered specifically to interview resource persons, keynote speakers, and conference guests like a seasoned podcast host.

The agent features **Retrieval-Augmented Generation (RAG)** for factual grounding on guest documents, **real-time logical reasoning**, **chain-of-thought analysis**, **dynamic follow-up question generation**, and **high-fidelity neural speech synthesis**.

---

## 🌟 Key Features

1. **End-to-End Voice Interaction**: Ultra-low latency Speech-to-Text (STT) and hyper-realistic Text-to-Speech (TTS) using **Deepgram Aura**.
2. **Logical Reasoning & Chain-of-Thought**: Before speaking, the AI host executes explicit internal reasoning (`<think>` steps) to analyze the guest's points, evaluate trade-offs, check the agenda, and formulate sharp follow-ups.
3. **In-Browser RAG Knowledge Base**: Upload guest documents and publications with **per-guest document tagging**. The agent uses semantic token search to ground its questions in the guest's actual work entirely in the browser.
4. **Multi-Guest & Multi-Persona Support**: Track multiple guests and active speakers in real-time. Switch between diverse AI Host personas (Alex, Elena, Marcus) with unique interviewing styles.
5. **Immersive 3D Visualizer**: Features a stunning, interactive 3D particle and waveform visualizer built with modern web technologies.
6. **Flexible LLM Backends**: Operates using local open-source models (Ollama) or fast cloud inference APIs (Groq).

---

## 📐 System Architecture

```text
                       🎙️ GUEST VOICE INPUT (Microphone)
                                      │
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       Speech-to-Text (STT) Processing           │
             │   - Deepgram WebSocket Streaming API            │
             │   - Real-time transcription & diarization       │
             └────────────────────────┬────────────────────────┘
                                      │ Transcribed Text
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │          Context Memory & RAG Indexer           │
             │   - In-Memory Semantic Search over Guest Docs   │
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
             │  Engines: Ollama (Llama3.2/DeepSeek)            │
             │           Groq API (Fast Cloud Inference)       │
             └────────────────────────┬────────────────────────┘
                                      │ Host Response Text
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │         Text-to-Speech (TTS) Engine             │
             │   - Deepgram Aura TTS (Ultra-low latency)       │
             └────────────────────────┬────────────────────────┘
                                      │
                                      ▼
                      🔊 AI HOST AUDIO PLAYBACK & 3D WAVEFORM
```

---

## 🛠️ Tools & Technologies Used

| Layer | Tool / Technology | Why Selected? |
| :--- | :--- | :--- |
| **Frontend UI** | React + Vite + Custom CSS | High-performance, responsive UI with beautiful glassmorphism. |
| **3D & Animation** | CSS/SVG Animations + React | Immersive, real-time particle audio visualizers without heavy WebGL overhead. |
| **Speech-to-Text** | Deepgram WebSocket API | Real-time streaming transcription with speaker diarization. |
| **Text-to-Speech** | Deepgram Aura API | Lightning-fast, hyper-realistic voice synthesis. |
| **RAG System** | In-Browser Token Search | Fast, zero-dependency semantic search for guest knowledge chunks directly on the client. |
| **LLM Engine** | Ollama / Groq API | Enables structured reasoning loops and rich podcast host roleplay with multi-persona support. |

---

## 🚀 Quick Start Guide

### 1. Environment Setup
Create a `.env` file in the root directory to store your API keys:
```env
GROQ_API_KEY=your_groq_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```
*(Note: Your Python backend will automatically detect the `.env` file in the root folder).*

### 2. Python Backend (FastAPI)
The backend handles the Deepgram STT/TTS proxying to protect your API keys.
Open a terminal in the project root:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install -r requirements.txt
python main.py
```
The backend will run on `http://localhost:8000`.

### 3. Web Podcast Studio (Frontend)
Open a **new** terminal in the project root:
```bash
npm install
npm run dev
```
Open `http://localhost:3000` (or the port specified by Vite) in your browser. Open the settings panel (gear icon) to configure your models and adjust the host persona!

---

## 💡 Prompt Engineering & Chain-of-Thought Design

The core intelligence of the podcaster host lies in enforcing a **Thinking Step** before generating the spoken response. Here is the system prompt blueprint used by the agent (JOY):

```text
You are JOY, an intelligent AI podcast host at Tech AI Summit 2026.
Main Topic: Scalable Autonomous Reasoning Agents

REASONING INSTRUCTIONS:
Before writing your verbal response, you MUST think logically inside <think>...</think> tags:
1. Identify who just spoke.
2. Note which script questions have already been asked.
3. Formulate a contextual, brief, conversational follow-up based on the RAG context.

FORMAT REQUIRED:
<think>
[Analytical thoughts...]
</think>
[JOY's spoken podcast response]
```

This ensures the AI host avoids generic replies and instead acts like a professional interviewer, actively analyzing the guest's insights!
