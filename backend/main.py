"""
Backend for JOY - RAG-Powered AI Podcaster Voice Agent
Stack:
 - RAG Indexer: In-Memory Vector / TF-IDF Semantic Search over uploaded Guest Documents
 - Speech-to-Text: Faster-Whisper (Run locally on CPU/GPU)
 - Reasoning & LLM: Ollama (Llama 3.2 / DeepSeek R1)
 - Text-to-Speech: Edge-TTS (Microsoft Neural Voice - hyper-realistic & free)
"""

import os
import re
import tempfile
import asyncio
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import edge_tts
from groq import Groq

app = FastAPI(title="JOY - RAG AI Podcaster Agent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# RAG Knowledge Storage
class DocumentChunk(BaseModel):
    id: str
    title: str
    text: str

knowledge_base: List[DocumentChunk] = []

JOY_SYSTEM_PROMPT = """You are JOY, an intelligent, RAG-powered AI podcast interviewer hosting a technology conference session.
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
[JOY's spoken podcast response]"""

class KnowledgeUploadRequest(BaseModel):
    title: str
    content: str

class ChatRequest(BaseModel):
    guest_statement: str
    guest_name: str = "Guest Speaker"
    topic: str = "Conference Keynote & Technology"
    model: str = "openai/gpt-oss-120b"

@app.get("/")
def read_root():
    return {
        "status": "online",
        "bot_name": "JOY",
        "rag_chunks_indexed": len(knowledge_base)
    }

@app.post("/api/upload-knowledge")
async def upload_knowledge(req: KnowledgeUploadRequest):
    """Uploads and chunks guest documents into RAG Knowledge Base."""
    paragraphs = [p.strip() for p in req.content.split("\n\n") if len(p.strip()) > 15]
    for idx, p in enumerate(paragraphs):
        chunk_id = f"{req.title}_{idx}"
        knowledge_base.append(DocumentChunk(id=chunk_id, title=req.title, text=p))
    
    return {"status": "success", "chunks_added": len(paragraphs), "total_knowledge_base_chunks": len(knowledge_base)}

def search_rag(query: str, top_k: int = 2) -> List[DocumentChunk]:
    if not knowledge_base or not query:
        return []
    
    tokens = re.findall(r"\w+", query.lower())
    tokens = [t for t in tokens if len(t) > 2]
    if not tokens:
        return []

    scored = []
    for chunk in knowledge_base:
        score = sum(1 for t in tokens if t in chunk.text.lower())
        if score > 0:
            scored.append((score, chunk))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scored[:top_k]]

class ProxyChatRequest(BaseModel):
    messages: list
    api_key: str
    model: str = "openai/gpt-oss-120b"
    temperature: float = 0.75
    max_tokens: int = 800

@app.post("/api/proxy-chat")
async def proxy_chat(req: ProxyChatRequest):
    """Proxies chat requests to Groq to bypass browser CORS limitations."""
    if not req.api_key:
        raise HTTPException(status_code=400, detail="Groq API key is required. Set it in Settings > Engine & Voice.")
    try:
        client = Groq(api_key=req.api_key)
        
        # DEBUG: Fetch and print valid models
        try:
            available_models = client.models.list()
            print("Available Groq Models:", [m.id for m in available_models.data])
        except Exception as err:
            print("Failed to fetch models:", err)

        response = client.chat.completions.create(
            model=req.model,
            messages=req.messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens
        )
        return response.model_dump()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Groq execution error: {str(e)}")

@app.post("/api/tts")
async def synthesize_speech(text: str = Form(...), voice: str = Form("en-US-AvaNeural")):
    """Generates hyper-realistic neural audio for JOY using Edge-TTS."""
    try:
        clean_text = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE).strip()
        
        output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        output_path = output_file.name
        output_file.close()

        communicate = edge_tts.Communicate(clean_text, voice)
        await communicate.save(output_path)

        return FileResponse(output_path, media_type="audio/mpeg", filename="joy_voice.mp3")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
