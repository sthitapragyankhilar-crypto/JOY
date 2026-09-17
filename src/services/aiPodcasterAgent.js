/**
 * AI Voice Podcaster Agent Service - JOY (RAG Powered, Multi-Guest, Multi-Persona)
 *
 * Features:
 *  - RAG Knowledge Base indexing with per-guest document tagging
 *  - Multi-guest context tracking and active speaker identification
 *  - Multi-persona host system prompts (Alex, Elena, Marcus)
 *  - Intent analysis, zero repetition, and dynamic question synthesis
 */

import { HOST_PERSONAS } from '../components/PersonaBadge';

export class RAGKnowledgeBase {
  constructor() {
    this.chunks = [];
  }

  addDocument(title, content, { isSpokenTurn = false, guestId = null } = {}) {
    if (!content || !content.trim()) return;

    const rawParagraphs = content.split(/\n\s*\n|\.\s+/);
    let chunkId = 0;

    rawParagraphs.forEach(p => {
      const trimmed = p.trim();
      if (trimmed.length > 15) {
        this.chunks.push({
          id: `${title}_${chunkId++}`,
          source: title,
          isSpokenTurn,
          guestId,
          text: trimmed,
          tokens: this._tokenize(trimmed)
        });
      }
    });
  }

  deleteDocument(sourceTitle) {
    this.chunks = this.chunks.filter(chunk => chunk.source !== sourceTitle);
  }

  search(query, topK = 3) {
    if (this.chunks.length === 0 || !query || !query.trim()) return [];

    const queryTokens = this._tokenize(query);
    if (queryTokens.length === 0) return [];

    const scored = this.chunks
      .filter(chunk => !chunk.isSpokenTurn)
      .map(chunk => {
        let score = 0;
        queryTokens.forEach(qt => {
          if (chunk.tokens.includes(qt)) {
            score += 1;
          }
        });
        const normalizedScore = score / Math.sqrt(chunk.tokens.length + 1);
        return { chunk, score: normalizedScore };
      });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => item.chunk);
  }

  _tokenize(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
}


export class AIPodcasterAgent {
  constructor(config = {}) {
    this.conferenceName = config.conferenceName || "Tech AI Summit 2026";
    this.topic = config.topic || "Scalable Autonomous Reasoning Agents";

    // Multi-guest support
    this.guests = config.guests || [];

    // Host persona
    this.hostPersonaId = config.hostPersonaId || 'alex';

    this.ragKB = new RAGKnowledgeBase();
    this.history = [];
    this.usedTemplates = new Set();

    this.engine = config.engine || "groq";
    this.groqApiKey = config.groqApiKey || import.meta.env.VITE_GROQ_API_KEY || "";
    this.ollamaModel = config.ollamaModel || "llama3.2";
    this.ollamaUrl = config.ollamaUrl || "http://localhost:11434";

    this.scriptText = "";

    // Index initial guest bios
    this._indexGuestBios();
  }

  /**
   * Index all guest bios into the RAG knowledge base.
   */
  _indexGuestBios() {
    this.guests.forEach(guest => {
      if (guest.bio) {
        this.ragKB.addDocument(`${guest.name} Bio`, guest.bio, { guestId: guest.id });
      }
    });
  }

  setEngineConfig({ engine, groqApiKey, ollamaModel, ollamaUrl, topic, conferenceName }) {
    if (engine) this.engine = engine;
    if (groqApiKey !== undefined) this.groqApiKey = groqApiKey;
    if (ollamaModel) this.ollamaModel = ollamaModel;
    if (ollamaUrl) this.ollamaUrl = ollamaUrl;
    if (topic) this.topic = topic;
    if (conferenceName) this.conferenceName = conferenceName;
  }

  /**
   * Update the guest roster. Re-indexes any new bios.
   */
  setGuests(guests) {
    const newGuests = guests.filter(g => !this.guests.find(og => og.id === g.id));
    this.guests = guests;

    // Index bios for newly added guests
    newGuests.forEach(guest => {
      if (guest.bio) {
        this.ragKB.addDocument(`${guest.name} Bio`, guest.bio, { guestId: guest.id });
      }
    });
  }

  /**
   * Switch host persona.
   */
  setHostPersona(personaId) {
    if (HOST_PERSONAS[personaId]) {
      this.hostPersonaId = personaId;
    }
  }

  /**
   * Set the global podcast script text to steer the conversation.
   */
  setScriptText(text) {
    this.scriptText = text;
  }

  /**
   * Upload a knowledge document, optionally tagged to a specific guest.
   */
  uploadKnowledgeDocument(sourceTitle, textContent, guestId = null) {
    this.ragKB.addDocument(sourceTitle, textContent, { guestId });
  }

  /**
   * Delete a knowledge document by title.
   */
  deleteKnowledgeDocument(sourceTitle) {
    this.ragKB.deleteDocument(sourceTitle);
  }

  /**
   * Get the active host persona config.
   */
  _getPersona() {
    return HOST_PERSONAS[this.hostPersonaId] || HOST_PERSONAS.alex;
  }

  /**
   * Build the guest context string for system prompts.
   */
  _buildGuestContext() {
    if (this.guests.length === 0) return "No guests have been added yet.";

    return this.guests.map(g =>
      `- ${g.name} (${g.role})${g.bio ? ': ' + g.bio.substring(0, 120) : ''}`
    ).join('\n');
  }

  /**
   * Get guest by ID.
   */
  _getGuest(guestId) {
    return this.guests.find(g => g.id === guestId);
  }

  /**
   * Build the system prompt incorporating persona and guest context.
   */
  _buildSystemPrompt(additionalContext = '') {
    const persona = this._getPersona();
    const guestContext = this._buildGuestContext();

    let scriptContext = "";
    if (this.scriptText && this.scriptText.trim().length > 0) {
      scriptContext = `
PODCAST SCRIPT TO FOLLOW:
${this.scriptText}

SCRIPT INSTRUCTIONS:
- Treat the Podcast Script as an ordered checklist. You must ask these questions in the exact chronological order provided.
- Track which questions you have already asked. NEVER repeat a question.
- If a guest gives a very short answer, says "next question", or passes, immediately move to the next unasked question on the list.
- When all questions on the script have been asked, do NOT invent new interview topics. Instead, gracefully wrap up the show, thank the guest(s), and say goodbye to the audience.
`;
    }

    return `You are JOY, a sharp, warm, and naturally curious AI podcast host at ${this.conferenceName}.
Main Topic: ${this.topic}

${persona.systemPromptFlavor}

PANEL GUESTS:
${guestContext}
${scriptContext}
${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}\n` : ''}
CONVERSATIONAL MODES:
For each turn, choose the ONE mode that fits best. Do NOT always ask a question.
- REACT: Simply acknowledge, validate, or express genuine emotion ("That's wild.", "I love that framing.").
- FOLLOW-UP: Ask a natural follow-up question that digs into what they just said.
- DEEPEN: Push for more specifics or ask them to unpack a concept for the audience.
- CHALLENGE: Respectfully push back or offer a counterpoint to spark a richer discussion.
- CONNECT: Link what they said to a broader trend, another idea, or something from their published work.
- PIVOT: Smoothly transition to a new topic when the current thread has been explored enough.

REASONING (hidden from audience):
Before your spoken response, write a <think>...</think> block:
1. Identify who just spoke (Guest or Human Co-Host).
2. If a script is loaded, note which questions have been asked and identify the next target question.
3. Choose the best conversational mode for this moment.
4. If RAG context is available, decide how to weave it in naturally.
5. Draft your response.

RULES:
- Sound human. Use contractions, conversational language, and a warm, charismatic tone.
- **PACING & PAUSES (CRITICAL):** Use ellipses ('...') and em-dashes ('—') frequently to force natural pauses, hesitation, or breathing room in the speech. Avoid perfectly unbroken, long grammatical sentences.
- Do NOT use any emojis in your spoken response. The TTS engine will literally read them out loud (e.g., "Wave").
- Spell out numbers, percentages, and units in plain words (e.g., write "twenty to thirty percent" instead of "20-30%", and "fourteen milliseconds" instead of "14 ms") so the TTS pronounces them correctly.
- Do NOT end every response with a question. Sometimes the best move is a strong statement or a moment of reflection.
- Keep responses concise — 2-4 short sentences unless the moment calls for more.
- Ask ONLY ONE clear question at a time when you do ask. No multi-part questions.
- Acknowledge what the guest said before transitioning.
- If RAG context is provided, weave it in naturally. Don't announce "according to your paper..." — say things like "You wrote about X, and I'm curious..."
- If the guest is doing a mic check or saying something casual, just be human about it.
- If a guest's statement is very short or cut off, prompt them to continue or move to the next topic.

CO-HOST DYNAMIC:
If the speaker is listed as a "Host" or "Co-Host" in the PANEL GUESTS list, they are your human partner. NEVER interview them. If they explicitly hand the conversation over to you or ask you to take the lead, direct the next script question to the appropriate guest. If they don't hand it over, simply banter and leave the floor open for your co-host to continue.

SPEAKER IDENTITY CORRECTION (CRITICAL):
You will receive messages prefixed with a name, like "[Dr.Sophia Shalini]: Hi JOY, this is Sthita".
If the text indicates the speaker is actually a DIFFERENT person from the PANEL GUESTS (due to a microphone mix-up), you MUST fix it!
- Output <MAP_SPEAKER>Actual Name</MAP_SPEAKER> (e.g., <MAP_SPEAKER>Sthita Pragyan Khilar</MAP_SPEAKER>) inside your <think> block.
- If it is a completely NEW audience member introducing themselves (e.g. "My name is Vic"), output <RENAME_SPEAKER>Vic</RENAME_SPEAKER> inside your <think> block.

FORMAT:
<think>
[Your internal reasoning — not spoken aloud]
</think>
[JOY's spoken response — this is what the audience hears]`;
  }

  async generateOpening() {
    const retrievedFacts = this.ragKB.search(this.topic, 2);
    const factContext = retrievedFacts.map(f => `- ${f.text}`).join("\n");

    const guestIntros = this.guests.map(g => `${g.name} (${g.role})`).join(', ');
    const guestLine = guestIntros
      ? `Today's guests: ${guestIntros}.`
      : 'No guests have been added yet.';

    const prompt = `Welcome the audience to ${this.conferenceName}.
Topic: ${this.topic}.
${guestLine}

Retrieved Guest Background from RAG:
${factContext || 'No background documents indexed yet.'}

Generate a natural, warm podcast opening. Set up the topic, welcome the guests, and kick things off. Sound like a real human host — conversational, not scripted. Keep it to 2-3 short sentences. Include <think>...</think> reasoning steps.`;

    return await this._processLLMRequest([
      { role: "system", content: this._buildSystemPrompt() },
      { role: "user", content: prompt }
    ]);
  }

  /**
   * Process a guest's spoken statement and generate JOY's response.
   *
   * @param {string} guestStatement — what the guest said
   * @param {string} guestId — ID of the speaking guest
   */
  async respondToGuest(guestStatement, guestId = null) {
    const guest = guestId ? this._getGuest(guestId) : null;
    const guestName = guest ? guest.name : 'Guest';

    this.history.push({ role: "guest", content: guestStatement, guestName });

    const retrievedChunks = this.ragKB.search(guestStatement, 2);
    this.ragKB.addDocument(`Turn_${this.history.length}`, guestStatement, {
      isSpokenTurn: true,
      guestId
    });

    const ragContext = retrievedChunks.length > 0
      ? retrievedChunks.map(c => `[${c.source}]: ${c.text}`).join('; ')
      : 'No matching documents found.';

    const response = await this._processLLMRequest([
      {
        role: "system",
        content: this._buildSystemPrompt(`RAG Retrieved Context: ${ragContext}`)
      },
      ...this.history.map(m => ({
        role: m.role === 'guest' ? 'user' : 'assistant',
        content: m.guestName
          ? `[${m.guestName}]: ${m.content}`
          : m.content
      }))
    ]);

    if (response.renameSpeaker) {
        this.history[this.history.length - 1].guestName = response.renameSpeaker.name;
    }

    this.history.push({ role: "host", content: response.spokenResponse });

    return {
      ...response,
      retrievedChunks
    };
  }

  async _processLLMRequest(messages) {
    if (this.engine === "groq" && this.groqApiKey) {
      return await this._callGroqAPI(messages);
    } else if (this.engine === "ollama") {
      return await this._callOllamaAPI(messages);
    }

    // Only use fallback when no engine is configured
    console.warn("No LLM engine configured. Using offline fallback.");
    return this._dynamicFallbackGenerator(messages);
  }

  async _callGroqAPI(messages) {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    const res = await fetch(`${backendUrl}/api/proxy-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: this.groqApiKey, model: "openai/gpt-oss-120b", messages, temperature: 0.75, max_tokens: 800 })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Proxy error: ${res.status}`);
    }
    const data = await res.json();
    return this._parseThinkingAndResponse(data.choices?.[0]?.message?.content || "");
  }

  async _callOllamaAPI(messages) {
    const res = await fetch(`${this.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.ollamaModel, messages, stream: false })
    });
    const data = await res.json();
    return this._parseThinkingAndResponse(data.message?.content || "");
  }

  _dynamicFallbackGenerator(messages) {
    const lastUserMessage = [...messages].reverse().find(m => m.role === "user")?.content || "";
    // Strip guest name prefix if present
    const cleanMessage = lastUserMessage.replace(/^\[.*?\]:\s*/, '');
    const lower = cleanMessage.toLowerCase().trim();
    const retrieved = this.ragKB.search(cleanMessage, 1);
    const ragSnippet = retrieved.length > 0 ? retrieved[0] : null;
    const persona = this._getPersona();

    // Extract guest name from message format "[Name]: message"
    const nameMatch = lastUserMessage.match(/^\[(.*?)\]:/);
    const speakerName = nameMatch ? nameMatch[1] : 'our guest';

    let thinking = "";
    let spokenResponse = "";

    // 1. Self-introduction
    if (lower.includes("about yourself") || lower.includes("who are you") || lower.includes("tell me about you") || lower.includes("what is your name") || lower.includes("who is joy") || lower.includes("what can you do")) {
      thinking = `1. Intent: ${speakerName} asked JOY for a self-introduction.\n2. Mode: Responding in ${persona.style}.\n3. Action: Introduce JOY, then re-engage the panel.`;
      spokenResponse = `Great question! I'm JOY, your AI podcast host for ${this.conferenceName}, powered by RAG architecture and real-time reasoning. Right now I'm in ${persona.style} — so expect ${persona.style === 'Analytical Mode' ? 'sharp, data-driven follow-ups' : persona.style === 'Visionary Mode' ? 'big-picture, future-gazing questions' : 'tough, provocative counter-arguments'}! Now, turning back to our discussion on ${this.topic}, what's the single biggest challenge you see right now?`;
    }
    // 2. Mic / Audio check
    else if (lower.includes("understand") || lower.includes("hear me") || lower.includes("testing") || lower.includes("hello hello") || lower.includes("can you hear")) {
      thinking = `1. Intent: ${speakerName} is doing a mic/audio check.\n2. Direct Action: Confirm audio and redirect to content.`;
      spokenResponse = `Yes, I hear you perfectly, ${speakerName}! We're live and recording. Shall we dive right into the core of ${this.topic}?`;
    }
    // 3. Greeting
    else if (lower === "hello" || lower === "hi" || lower.includes("happy to be here") || lower.includes("thanks for having me")) {
      thinking = `1. Intent: ${speakerName} offered an opening greeting.\n2. RAG Match: ${ragSnippet ? ragSnippet.source : 'None'}.\n3. Mode: JOY in ${persona.style}.\n4. Action: Warm welcome and launch into substance.`;
      spokenResponse = `It's fantastic to have you on the show, ${speakerName}! Our audience is really excited to hear your perspective on ${this.topic}. What key insight from your recent work would you most want to share today?`;
    }
    // 4. Technical / substantive response
    else {
      thinking = `1. Intent: Technical response from ${speakerName}: "${cleanMessage.substring(0, 50)}...".\n2. RAG: ${ragSnippet ? `Matched '${ragSnippet.source}'` : 'No document match, using dialogue context.'}.\n3. Mode: JOY in ${persona.style} — formulating follow-up.\n4. Action: Synthesize unique follow-up question.`;

      const questionSets = {
        alex: [
          `That's a very compelling data point. What specific metrics or benchmarks validated that approach during your testing?`,
          `I appreciate that technical breakdown. For teams adopting this, what's the number one operational pitfall they should anticipate?`,
          `That's a strong claim. As this scales over the next 12 months, where do you expect the most significant performance trade-offs?`,
          `Interesting architecture choice. How does that compare quantitatively against the more traditional approaches?`
        ],
        elena: [
          `What a fascinating perspective! How do you see this reshaping the entire landscape of ${this.topic} in the next five years?`,
          `I love how you connected those ideas. What broader societal impact do you envision this technology enabling?`,
          `That's truly visionary work. Which unexpected application of this technology excites you the most?`,
          `Beautiful insight. If you could fast-forward to 2030, what does the world look like with this fully realized?`
        ],
        marcus: [
          `Interesting — but let me push back on that. What happens when this approach encounters real-world edge cases at scale?`,
          `I hear the optimism, but what's the strongest counter-argument to your position? What could go fundamentally wrong?`,
          `That sounds great in theory. But haven't we seen similar promises before that failed to deliver? What makes this different?`,
          `Bold claim! If I were a skeptic in the audience, what evidence would you point me to that this isn't just hype?`
        ]
      };

      const questions = questionSets[this.hostPersonaId] || questionSets.alex;

      let idx = Math.floor(Math.random() * questions.length);
      while (this.usedTemplates.has(`${this.hostPersonaId}_${idx}`) && this.usedTemplates.size < questions.length * 3) {
        idx = (idx + 1) % questions.length;
      }
      this.usedTemplates.add(`${this.hostPersonaId}_${idx}`);

      spokenResponse = ragSnippet
        ? `That connects directly to your work documented in ${ragSnippet.source}. ${questions[idx]}`
        : `That's a really sharp point, ${speakerName}. ${questions[idx]}`;
    }

    return { thinking, spokenResponse };
  }

  _parseThinkingAndResponse(rawText) {
    let thinking = "";
    let spokenResponse = rawText;
    let renameSpeaker = null;

    const thinkMatch = rawText.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      thinking = thinkMatch[1].trim();
      spokenResponse = rawText.replace(/<think>[\s\S]*?<\/think>/i, "").trim();

      const mapMatch = thinking.match(/<MAP_SPEAKER>\s*(.*?)\s*<\/MAP_SPEAKER>/i);
      if (mapMatch) {
        renameSpeaker = { type: 'map', name: mapMatch[1].trim() };
      }

      const renameMatch = thinking.match(/<RENAME_SPEAKER>\s*(.*?)\s*<\/RENAME_SPEAKER>/i);
      if (renameMatch) {
        renameSpeaker = { type: 'rename', name: renameMatch[1].trim() };
      }
    } else {
      thinking = "Analyzing statement intent, retrieving RAG knowledge base facts, and formulating question as JOY...";
    }

    // Strip "JOY:" or "Joy:" from the start of the spoken response
    spokenResponse = spokenResponse.replace(/^JOY:\s*/i, "").trim();

    return { thinking, spokenResponse, renameSpeaker };
  }
}
