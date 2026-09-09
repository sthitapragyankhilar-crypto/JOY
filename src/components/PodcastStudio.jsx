import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Play, Settings, Brain, Sparkles,
  MessageSquare, FileText, Search, Upload
} from 'lucide-react';
import { AIPodcasterAgent } from '../services/aiPodcasterAgent';
import { AudioEngine } from '../services/audioEngine';
import { HOST_PERSONAS, PersonaBadge } from './PersonaBadge';
import { GuestPanel } from './GuestPanel';
import { SettingsModal } from './SettingsModal';
import { WaveformVisualizer } from './WaveformVisualizer';

/**
 * Default guests — pre-populated for demo purposes.
 */
const DEFAULT_GUESTS = [
  {
    id: crypto.randomUUID(),
    name: 'Dr. Sarah Lin',
    role: 'VP of AI Research',
    color: '#1e3a5f',
    avatar: '👩‍💼',
    bio: 'Dr. Sarah Lin is the VP of AI Research specializing in Distributed Neural Reasoning and Sparse Attention Architectures. She published a paper on Low-Latency Attention Mechanisms reducing LLM memory overhead by 40%.',
    isActive: true
  }
];

export function PodcastStudio() {
  const agentRef = useRef(null);
  const audioRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const guestTextRef = useRef('');
  const isContinuousModeRef = useRef(false);

  // Studio State
  const [stageStatus, setStageStatus] = useState('idle');
  const [currentThinking, setCurrentThinking] = useState('');
  const [retrievedSnippets, setRetrievedSnippets] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [guestText, setGuestText] = useState('');
  const [extractedInsights, setExtractedInsights] = useState([]);
  const [analyserNode, setAnalyserNode] = useState(null);

  // Multi-Guest State
  const [guests, setGuests] = useState(DEFAULT_GUESTS);
  const [activeGuestId, setActiveGuestId] = useState(DEFAULT_GUESTS[0].id);

  // Host Persona
  const [hostPersonaId, setHostPersonaId] = useState('alex');

  // RAG Knowledge State
  const [knowledgeText, setKnowledgeText] = useState('');
  const [indexedDocs, setIndexedDocs] = useState([
    "Dr. Sarah Lin - VP of AI Research (Distributed Neural Reasoning & Sparse Attention, 2025)"
  ]);

  // Config State
  const [config, setConfig] = useState({
    conferenceName: 'Tech AI Summit 2026',
    topic: 'Scalable Autonomous Reasoning Agents',
    engine: 'groq',
    groqApiKey: import.meta.env.VITE_GROQ_API_KEY || '',
    ollamaModel: 'llama3.2',
    ollamaUrl: 'http://localhost:11434'
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Get active guest info
  const activeGuest = guests.find(g => g.id === activeGuestId) || guests[0];
  const hostPersona = HOST_PERSONAS[hostPersonaId] || HOST_PERSONAS.alex;

  // Initialize agent and audio engine
  useEffect(() => {
    agentRef.current = new AIPodcasterAgent({
      ...config,
      guests,
      hostPersonaId
    });
    audioRef.current = new AudioEngine();

    return () => {
      if (audioRef.current) {
        audioRef.current.destroy();
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, []);

  // Sync config changes to agent
  useEffect(() => {
    if (agentRef.current) {
      agentRef.current.setEngineConfig(config);
    }
  }, [config]);

  // Sync guests to agent
  useEffect(() => {
    if (agentRef.current) {
      agentRef.current.setGuests(guests);
    }
  }, [guests]);

  // Sync persona to agent
  useEffect(() => {
    if (agentRef.current) {
      agentRef.current.setHostPersona(hostPersonaId);
    }
  }, [hostPersonaId]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  const handleSelectGuest = useCallback((guestId) => {
    setActiveGuestId(guestId);
  }, []);

  const handleUploadKnowledge = () => {
    if (!knowledgeText.trim()) return;
    agentRef.current.uploadKnowledgeDocument(
      `User_Upload_${indexedDocs.length + 1}`,
      knowledgeText,
      activeGuestId
    );
    setIndexedDocs(prev => [...prev, `${knowledgeText.substring(0, 50)}...`]);
    setKnowledgeText('');
  };

  const handleStartInterview = async () => {
    setStageStatus('thinking');
    setCurrentThinking('JOY is retrieving guest background facts from RAG Knowledge Base and framing the opening question...');

    try {
      const response = await agentRef.current.generateOpening();
      setCurrentThinking(response.thinking);

      setTranscript([{
        sender: 'host',
        name: 'JOY (AI Host)',
        text: response.spokenResponse,
        thinking: response.thinking,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

      setStageStatus('speaking_host');
      audioRef.current.speakText(response.spokenResponse, {
        pitch: hostPersona.pitch,
        rate: hostPersona.rate,
        onEnd: () => {
          if (isContinuousModeRef.current) {
            handleStartListening();
          } else {
            setStageStatus('idle');
          }
        }
      });

      // Update analyser node for visualization
      setAnalyserNode(audioRef.current.getAnalyserNode());
    } catch (err) {
      console.error("Error generating intro:", err);
      setStageStatus('idle');
    }
  };

  const handlePauseInterview = () => {
    isContinuousModeRef.current = false;
    audioRef.current.stopListening();
    audioRef.current.stopSpeaking();
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    setStageStatus('idle');
  };

  const handleStartListening = () => {
    audioRef.current.stopSpeaking();
    setGuestText('');
    setInterimText('');
    guestTextRef.current = '';
    setStageStatus('listening_guest');
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

    audioRef.current.startListening({
      onTranscript: ({ interim, final: finalText }) => {
        setInterimText(interim);
        if (finalText) {
          const newText = guestTextRef.current ? `${guestTextRef.current} ${finalText}` : finalText;
          setGuestText(newText);
          guestTextRef.current = newText;
        }

        // Clear existing silence timeout
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

        // Set 3-second silence timeout
        silenceTimeoutRef.current = setTimeout(() => {
          const currentText = guestTextRef.current || interim;
          if (currentText.trim().length > 0) {
            audioRef.current.stopListening();
            processGuestAnswer(currentText.trim());
          }
        }, 3000);
      }
    });

    // Grab analyser after mic starts
    setTimeout(() => {
      setAnalyserNode(audioRef.current.getAnalyserNode());
    }, 300);
  };

  const processGuestAnswer = async (answerText) => {
    const textToProcess = answerText || guestText;
    if (!textToProcess.trim()) return;

    const speakerGuest = activeGuest;

    setTranscript(prev => [...prev, {
      sender: 'guest',
      name: speakerGuest?.name || 'Guest',
      text: textToProcess,
      guestColor: speakerGuest?.color,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setGuestText('');
    setInterimText('');

    if (textToProcess.length > 20) {
      setExtractedInsights(prev => [
        { id: Date.now(), text: textToProcess.substring(0, 80) + '...', author: speakerGuest?.name || 'Guest' },
        ...prev.slice(0, 4)
      ]);
    }

    setStageStatus('thinking');
    setCurrentThinking(`JOY is searching RAG vector store for context related to: "${textToProcess.substring(0, 40)}..."`);

    try {
      const response = await agentRef.current.respondToGuest(textToProcess, activeGuestId);
      setCurrentThinking(response.thinking);
      setRetrievedSnippets(response.retrievedChunks || []);

      setTranscript(prev => [...prev, {
        sender: 'host',
        name: 'JOY (AI Host)',
        text: response.spokenResponse,
        thinking: response.thinking,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

      setStageStatus('speaking_host');
      audioRef.current.speakText(response.spokenResponse, {
        pitch: hostPersona.pitch,
        rate: hostPersona.rate,
        onEnd: () => {
          if (isContinuousModeRef.current) {
            handleStartListening();
          } else {
            setStageStatus('idle');
          }
        }
      });
    } catch (err) {
      console.error("Error processing response:", err);
      setStageStatus('idle');
    }
  };

  const handleGuestsChange = (newGuests) => {
    setGuests(newGuests);
    // If active guest was removed, select first remaining
    if (newGuests.length > 0 && !newGuests.find(g => g.id === activeGuestId)) {
      setActiveGuestId(newGuests[0].id);
    }
  };

  return (
    <div className="studio-container">

      {/* ========== HEADER ========== */}
      <header className="glass-panel studio-header">
        <div className="studio-header__left">
          <div className="studio-header__logo">🤖</div>
          <div style={{ minWidth: 0 }}>
            <h1 className="studio-header__title">
              JOY — AI Voice Podcaster Studio
              <span className="badge badge-purple">100% Free & Open Source</span>
            </h1>
            <p className="studio-header__subtitle">
              {config.conferenceName} &bull; <strong style={{ color: 'var(--text-main)' }}>{config.topic}</strong>
            </p>
          </div>
        </div>

        <div className="studio-header__right">
          <PersonaBadge personaId={hostPersonaId} />

          {stageStatus === 'speaking_host' && <div className="badge badge-cyan">JOY SPEAKING</div>}
          {stageStatus === 'listening_guest' && <div className="badge badge-emerald">LISTENING</div>}
          {stageStatus === 'thinking' && (
            <div className="badge badge-amber">
              <Brain size={14} className="animate-spin" /> REASONING...
            </div>
          )}
          {stageStatus === 'idle' && (
            <div className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
              STUDIO IDLE
            </div>
          )}

          <button className="btn-secondary" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={18} /> Settings
          </button>
        </div>
      </header>

      {/* ========== MAIN GRID ========== */}
      <div className="studio-grid">

        {/* ---- Left Column: Main Content ---- */}
        <div className="studio-main">

          {/* Stage: Guest Panel */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>PODCAST STAGE</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
                RAG Vector Engine Active &bull; {guests.length} Guest{guests.length !== 1 ? 's' : ''}
              </span>
            </h2>

            <GuestPanel
              guests={guests}
              activeGuestId={activeGuestId}
              hostPersona={hostPersona}
              stageStatus={stageStatus}
              analyserNode={analyserNode}
              onSelectGuest={handleSelectGuest}
            />

            {/* Stage Controls */}
            <div className="stage-controls" style={{ marginTop: '24px' }}>
              {transcript.length === 0 ? (
                <button
                  className="btn-primary"
                  style={{ padding: '14px 28px', fontSize: '1rem' }}
                  onClick={() => {
                    isContinuousModeRef.current = true;
                    handleStartInterview();
                  }}
                  disabled={guests.length === 0}
                >
                  <Play size={20} /> Start Podcast with JOY
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn-secondary"
                    onClick={handlePauseInterview}
                  >
                    Pause Interview
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
                      audioRef.current.stopListening();
                      processGuestAnswer(guestTextRef.current || interimText);
                    }}
                    disabled={stageStatus !== 'listening_guest'}
                  >
                    Send to JOY Now (Interrupt)
                  </button>
                </div>
              )}
            </div>

            {/* Text Input while listening */}
            {stageStatus === 'listening_guest' && (
              <div className="stage-input-row">
                <input
                  type="text"
                  value={guestText || interimText}
                  onChange={(e) => setGuestText(e.target.value)}
                  placeholder="Type or speak into microphone..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      audioRef.current.stopListening();
                      processGuestAnswer(e.target.value);
                    }
                  }}
                />
                <button
                  className="btn-primary"
                  onClick={() => {
                    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
                    audioRef.current.stopListening();
                    processGuestAnswer(guestTextRef.current || interimText);
                  }}
                >
                  Send to JOY
                </button>
              </div>
            )}
          </div>

          {/* Reasoning & RAG Retrieval Stream */}
          {currentThinking && (
            <div className="glass-panel animate-slide-up" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', marginBottom: '12px' }}>
                <Brain size={20} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>JOY's Internal Reasoning & RAG Knowledge Search</h3>
              </div>
              <div className="reasoning-box" style={{ whiteSpace: 'pre-wrap' }}>
                {currentThinking}
              </div>

              {retrievedSnippets.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderLeft: '3px solid var(--primary-glow)',
                  padding: '10px 14px',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.8rem',
                  color: '#c7d2fe'
                }}>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Search size={14} /> RAG Retrieved Passage ({retrievedSnippets[0].source}):
                  </div>
                  "{retrievedSnippets[0].text}"
                </div>
              )}
            </div>
          )}

          {/* Transcript Stream */}
          <div className="glass-panel" style={{ padding: '20px', flex: 1, minHeight: '350px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} /> Podcast Live Transcript
            </h3>

            <div className="transcript-container">
              {transcript.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: 'var(--text-dim)',
                  fontSize: '0.9rem'
                }}>
                  Click "Start Podcast with JOY" to begin the interview session.
                </div>
              )}

              {transcript.map((msg, index) => (
                <div
                  key={index}
                  className={`transcript-msg ${msg.sender === 'host' ? 'transcript-msg--host' : 'transcript-msg--guest'}`}
                >
                  <strong
                    className="transcript-msg__sender"
                    style={{
                      color: msg.sender === 'host'
                        ? 'var(--primary-glow)'
                        : msg.guestColor ? '#6ee7b7' : '#6ee7b7'
                    }}
                  >
                    {msg.name}
                    <span style={{ fontWeight: 400, fontSize: '0.72rem', color: 'var(--text-dim)', marginLeft: '8px' }}>
                      {msg.time}
                    </span>
                  </strong>
                  <p className="transcript-msg__text">{msg.text}</p>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>

        {/* ---- Right Column: Sidebar ---- */}
        <div className="studio-sidebar">

          {/* RAG Knowledge Upload Card */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: 'var(--accent-cyan)' }} />
              Upload Guest RAG Knowledge
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Upload guest papers, bio, or talk notes. JOY indexes them in vector storage to build context!
              {activeGuest && (
                <span style={{ color: 'var(--accent-emerald)' }}> (Tagged to: {activeGuest.name})</span>
              )}
            </p>

            <textarea
              className="form-input"
              rows={4}
              value={knowledgeText}
              onChange={e => setKnowledgeText(e.target.value)}
              placeholder="Paste Guest Bio, Research Papers, or Keynote Abstract here..."
              style={{ marginBottom: '10px', resize: 'none' }}
            />

            <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleUploadKnowledge}>
              <Upload size={16} /> Index Knowledge Source
            </button>

            <div style={{ marginTop: '14px', fontSize: '0.78rem', color: 'var(--accent-emerald)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {indexedDocs.map((doc, idx) => (
                <div key={idx} style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '3px solid var(--accent-emerald)', padding: '6px 8px', borderRadius: '4px' }}>
                  ✓ {doc}
                </div>
              ))}
            </div>
          </div>

          {/* Key Takeaways */}
          <div className="glass-panel" style={{ padding: '20px', flex: 1 }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--accent-amber)' }} />
              Real-time Key Takeaways
            </h3>

            {extractedInsights.length === 0 && (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem', fontStyle: 'italic' }}>
                Key quotes and insights will appear here as the interview progresses...
              </div>
            )}

            {extractedInsights.map(insight => (
              <div key={insight.id} style={{
                background: 'rgba(245, 158, 11, 0.08)',
                borderLeft: '3px solid var(--accent-amber)',
                padding: '10px 12px',
                borderRadius: '0 8px 8px 0',
                fontSize: '0.85rem',
                marginBottom: '10px'
              }}>
                <p style={{ margin: 0, fontStyle: 'italic', color: '#fef08a' }}>"{insight.text}"</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  &mdash; {insight.author}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========== SETTINGS MODAL ========== */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onConfigChange={setConfig}
        guests={guests}
        onGuestsChange={handleGuestsChange}
        hostPersonaId={hostPersonaId}
        onPersonaChange={setHostPersonaId}
      />
    </div>
  );
}
