"""
Backend for JOY - RAG-Powered AI Podcaster Voice Agent
Stack:
 - Speech-to-Text: Faster-Whisper (Run locally on CPU/GPU)
 - Reasoning & LLM: Ollama (Llama 3.2 / DeepSeek R1)
 - Text-to-Speech: Edge-TTS (Microsoft Neural Voice - hyper-realistic & free)
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env, checking both current and parent directory
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if not os.path.exists(env_path):
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
load_dotenv(env_path)

import re
import tempfile
import traceback
import asyncio
import httpx
import websockets
from typing import List
from fastapi import FastAPI, Form, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
import edge_tts
from groq import Groq

app = FastAPI(title="JOY - AI Podcaster Agent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://joy-khaki.vercel.app"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/")
def read_root():
    return {
        "status": "online",
        "bot_name": "JOY"
    }

class ProxyChatRequest(BaseModel):
    messages: list
    api_key: str = ""
    model: str = "openai/gpt-oss-120b"
    temperature: float = 0.75
    max_tokens: int = 800

@app.post("/api/proxy-chat")
async def proxy_chat(req: ProxyChatRequest):
    """Proxies chat requests to Groq to bypass browser CORS limitations."""
    # Use provided API key or fallback to environment variable
    final_api_key = req.api_key if req.api_key else os.environ.get("GROQ_API_KEY")
    if not final_api_key:
        raise HTTPException(status_code=400, detail="Groq API key is missing. Set it in Settings or backend environment variables.")
    try:
        client = Groq(api_key=final_api_key)

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
    if len(text) > 5000:
        raise HTTPException(status_code=413, detail="Payload too large. Text must be under 5000 characters.")
        
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

@app.post("/api/deepgram-tts")
async def deepgram_tts(req: Request):
    """Proxies Deepgram TTS requests to hide the API key."""
    api_key = os.environ.get("DEEPGRAM_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="DEEPGRAM_API_KEY not configured on server")
    
    body = await req.json()
    voice = req.query_params.get("model", "aura-asteria-en")
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(
                f"https://api.deepgram.com/v1/speak?model={voice}",
                headers={
                    "Authorization": f"Token {api_key}",
                    "Content-Type": "application/json"
                },
                json=body
            )
            res.raise_for_status()
            return Response(content=res.content, media_type="audio/mpeg")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/api/stt")
async def stt_websocket(websocket: WebSocket):
    """Proxies STT websocket to Deepgram."""
    await websocket.accept()
    api_key = os.environ.get("DEEPGRAM_API_KEY")
    if not api_key:
        await websocket.close(code=1011, reason="DEEPGRAM_API_KEY not configured")
        return

    # Extract query params from incoming request
    query_string = websocket.url.query
    deepgram_url = f"wss://api.deepgram.com/v1/listen?{query_string}"

    try:
        async with websockets.connect(
            deepgram_url, 
            additional_headers={"Authorization": f"Token {api_key}"}
        ) as dg_ws:
            
            async def forward_to_deepgram():
                try:
                    count = 0
                    while True:
                        data = await websocket.receive_bytes()
                        count += 1
                        if count % 20 == 0:
                            print(f"Forwarded {count} chunks to Deepgram")
                        await dg_ws.send(data)
                except WebSocketDisconnect:
                    print("Client disconnected")
                except Exception as e:
                    print(f"Error forwarding to Deepgram: {e}")
                finally:
                    await dg_ws.close()

            async def forward_to_client():
                try:
                    while True:
                        message = await dg_ws.recv()
                        await websocket.send_text(message)
                        if '"is_final":true' in message or '"type":"Results"' in message:
                            print("Received Result from Deepgram")
                except websockets.exceptions.ConnectionClosed:
                    print("Deepgram closed connection")
                except Exception as e:
                    print(f"Error forwarding to client: {e}")
                finally:
                    await websocket.close()

            # Run both forwarding tasks concurrently
            await asyncio.gather(
                forward_to_deepgram(),
                forward_to_client()
            )

    except Exception as e:
        print(f"Failed to connect to Deepgram: {e}")
        try:
            await websocket.close(code=1011, reason="Failed to connect to STT provider")
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
