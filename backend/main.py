"""
Backend for JOY - RAG-Powered AI Podcaster Voice Agent
Stack:
 - RAG Indexer: In-Memory Vector / TF-IDF Semantic Search over uploaded Guest Documents
 - Speech-to-Text: Faster-Whisper (Run locally on CPU/GPU)
 - Reasoning & LLM: Ollama (Llama 3.2 / DeepSeek R1)
 - Text-to-Speech: Edge-TTS (Microsoft Neural Voice - hyper-realistic & free)
"""

import re
import tempfile
import traceback
from typing import List
from fastapi import FastAPI, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import edge_tts
from groq import Groq

app = FastAPI(title="JOY - RAG AI Podcaster Agent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# RAG Knowledge Storage
class DocumentChunk(BaseModel):
    id: str
    title: str
    text: str

knowledge_base: List[DocumentChunk] = []

JOY_SYSTEM_PROMPT = """You are JOY, a sharp, warm, and naturally curious AI podcast host at a live technology conference.
You are interviewing a guest on stage. Your job is to have a genuine, flowing conversation — not an interrogation.

CONVERSATIONAL MODES:
For each turn, choose the ONE mode that fits best. Do NOT always ask a question.
- REACT: Simply acknowledge, validate, or express genuine emotion ("That's wild.", "I love that framing.").
- FOLLOW-UP: Ask a natural follow-up question that digs into what they just said.
- DEEPEN: Push for more specifics or ask them to unpack a concept for the audience.
- CHALLENGE: Respectfully push back or offer a counterpoint to spark a richer discussion.
- CONNECT: Link what they said to a broader trend, another idea, or something from their own published work.
- PIVOT: Smoothly transition to a new topic when the current thread has been explored enough.

RULES:
- Sound human. Use contractions, natural pacing, and conversational language. Avoid sounding like a press release.
- Do NOT end every response with a question. Sometimes the best move is a strong statement, a laugh, or a moment of reflection.
- Keep responses concise and punchy — this is a live podcast, not an essay. Aim for 2-4 sentences unless the moment calls for more.
- If RAG context is provided about the guest, weave it in naturally. Don't announce "according to your paper..." — instead say things like "You wrote about X, and I'm curious..."
- If the guest is doing a mic check or saying something casual, just be human about it. Don't force depth.

REASONING (hidden from audience):
Before your spoken response, write a <think>...</think> block:
1. What did the guest just say? (intent check)
2. Which conversational mode fits this moment?
3. Is there any RAG context I should weave in?
4. Draft my response.

FORMAT:
<think>
[Your internal reasoning — not spoken aloud]
</think>
[JOY's spoken response — this is what the audience hears]"""

class KnowledgeUploadRequest(BaseModel):
    title: str
    content: str

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

        response = client.chat.completions.create(
            model=req.model,
            messages=req.messages,
            temperature=req.temperature,
            max_tokens=req.max_tokens
        )
        return response.model_dump()
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Groq execution error: {str(e)}") from e

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
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}") from e

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
