import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Brain } from 'lucide-react';
import { AIPodcasterAgent } from '../services/aiPodcasterAgent';
import { AudioEngine } from '../services/audioEngine';
import { HOST_PERSONAS } from './PersonaBadge';

// New Components
import { AISphere } from './AISphere';
import { StarField } from './StarField';
import { TopBar } from './TopBar';
import { ControlBar } from './ControlBar';
import { ConversationPanel } from './ConversationPanel';
import { MemoryPanel } from './MemoryPanel';
import { SettingsModal } from './SettingsModal';

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

export function AIInterface() {
  const agentRef = useRef(null);
  const audioRef = useRef(null);
  const audioContextPollerRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const guestTextRef = useRef('');
  const isContinuousModeRef = useRef(false);

  // Interface State
  const [stageStatus, setStageStatus] = useState('idle'); // idle, listening_guest, thinking, speaking_host
  const [audioLevel, setAudioLevel] = useState(0);

  // Panel State
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Data State
  const [transcript, setTranscript] = useState([]);
  const [interimText, setInterimText] = useState('');
  const [guestText, setGuestText] = useState('');
  const [knowledgeText, setKnowledgeText] = useState('');
  const [indexedDocs, setIndexedDocs] = useState([
    "Dr. Sarah Lin - VP of AI Research (Distributed Neural Reasoning & Sparse Attention, 2025)"
  ]);

  // Config State
  const [guests, setGuests] = useState(DEFAULT_GUESTS);
  const [activeGuestId, setActiveGuestId] = useState(DEFAULT_GUESTS[0].id);
  const [hostPersonaId, setHostPersonaId] = useState('alex');
  const [config, setConfig] = useState({
    conferenceName: 'Tech AI Summit 2026',
    topic: 'Scalable Autonomous Reasoning Agents',
    engine: 'groq',
    groqApiKey: import.meta.env.VITE_GROQ_API_KEY || '',
    ollamaModel: 'llama3.2',
    ollamaUrl: 'http://localhost:11434'
  });

  const activeGuest = guests.find(g => g.id === activeGuestId) || guests[0];
  const hostPersona = HOST_PERSONAS[hostPersonaId] || HOST_PERSONAS.alex;

  // Initialize
  useEffect(() => {
    agentRef.current = new AIPodcasterAgent({
      ...config,
      guests,
      hostPersonaId
    });
    audioRef.current = new AudioEngine();

    // Setup audio level polling for the sphere
    audioContextPollerRef.current = setInterval(() => {
      const analyser = audioRef.current?.getAnalyserNode();
      if (analyser && (stageStatus === 'listening_guest' || stageStatus === 'speaking_host')) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        // Calculate average amplitude (simplified RMS)
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Normalize 0-1
        const normalized = Math.min(1, avg / 128);

        // Smooth the level slightly
        setAudioLevel(prev => prev + (normalized - prev) * 0.2);
      } else {
        setAudioLevel(prev => prev > 0.05 ? prev * 0.9 : 0);
      }
    }, 50);

    return () => {
      if (audioRef.current) audioRef.current.destroy();
      if (audioContextPollerRef.current) clearInterval(audioContextPollerRef.current);
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
  }, []);

  // Sync state to agent
  useEffect(() => {
    if (agentRef.current) {
      agentRef.current.setEngineConfig(config);
      agentRef.current.setGuests(guests);
      agentRef.current.setHostPersona(hostPersonaId);
    }
  }, [config, guests, hostPersonaId]);

  // Handle Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleListening();
      } else if (e.code === 'Escape') {
        setLeftPanelOpen(false);
        setRightPanelOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

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
    isContinuousModeRef.current = true;
    setStageStatus('thinking');

    try {
      const response = await agentRef.current.generateOpening();

      setTranscript([{
        sender: 'host',
        name: 'JOY (AI Host)',
        text: response.spokenResponse,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

      setStageStatus('speaking_host');
      audioRef.current.speakText(response.spokenResponse, {
        pitch: hostPersona.pitch,
        rate: hostPersona.rate,
        onStart: () => audioRef.current.startMicVisualizer(), // reuse mic for output viz if needed
        onEnd: () => {
          if (isContinuousModeRef.current) {
            handleStartListening();
          } else {
            setStageStatus('idle');
          }
        }
      });
    } catch (err) {
      console.error("Error generating intro:", err);
      setStageStatus('idle');
    }
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

        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

        silenceTimeoutRef.current = setTimeout(() => {
          const currentText = guestTextRef.current || interim;
          if (currentText.trim().length > 0) {
            audioRef.current.stopListening();
            processGuestAnswer(currentText.trim());
          }
        }, 3000);
      }
    });
  };

  const handleToggleListening = () => {
    if (stageStatus === 'listening_guest') {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      audioRef.current.stopListening();
      processGuestAnswer(guestTextRef.current || interimText);
    } else {
      isContinuousModeRef.current = true;
      handleStartListening();
    }
  };

  const processGuestAnswer = async (answerText) => {
    if (!answerText.trim()) return;

    setTranscript(prev => [...prev, {
      sender: 'guest',
      name: activeGuest?.name || 'Guest',
      text: answerText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setGuestText('');
    setInterimText('');
    setStageStatus('thinking');

    try {
      const response = await agentRef.current.respondToGuest(answerText, activeGuestId);

      setTranscript(prev => [...prev, {
        sender: 'host',
        name: 'JOY (AI Host)',
        text: response.spokenResponse,
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

  const handleStop = () => {
    isContinuousModeRef.current = false;
    audioRef.current.stopListening();
    audioRef.current.stopSpeaking();
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    setStageStatus('idle');
  };

  return (
    <div className="ai-interface">
      <StarField />

      <div className="ai-interface__content">
        <TopBar
          hostPersonaId={hostPersonaId}
          stageStatus={stageStatus}
          isListening={stageStatus === 'listening_guest'}
        />

        {/* The Central Sphere */}
        <div className="sphere-container">
          <AISphere state={stageStatus} audioLevel={audioLevel} />

          <div className="sphere-label">
            <div className="sphere-label__name">JOY</div>
            <div className="sphere-label__mode">{hostPersona.style}</div>

            <div className={`sphere-label__status sphere-label__status--${stageStatus === 'listening_guest' ? 'listening' :
              stageStatus === 'thinking' ? 'thinking' :
                stageStatus === 'speaking_host' ? 'speaking' : 'idle'
              }`}>
              <div className={`status-dot status-dot--${stageStatus === 'listening_guest' ? 'listening' :
                stageStatus === 'thinking' ? 'thinking' :
                  stageStatus === 'speaking_host' ? 'speaking' : 'idle'
                }`} />
              {stageStatus === 'idle' && 'Idle'}
              {stageStatus === 'listening_guest' && 'Listening...'}
              {stageStatus === 'thinking' && 'Thinking...'}
              {stageStatus === 'speaking_host' && 'Speaking...'}
            </div>
          </div>
        </div>

        {/* Panel Toggles (Mobile + Desktop) */}
        <button
          className="panel-toggle panel-toggle--left"
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          aria-label="Toggle Conversation"
        >
          <MessageSquare size={18} />
        </button>

        <button
          className="panel-toggle panel-toggle--right"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          aria-label="Toggle Memory"
        >
          <Brain size={18} />
        </button>

        {/* Floating Panels */}
        <ConversationPanel
          isOpen={leftPanelOpen}
          onClose={() => setLeftPanelOpen(false)}
          transcript={transcript}
          guestText={guestText || interimText}
          stageStatus={stageStatus}
        />

        <MemoryPanel
          isOpen={rightPanelOpen}
          onClose={() => setRightPanelOpen(false)}
          indexedDocs={indexedDocs}
          knowledgeText={knowledgeText}
          onKnowledgeTextChange={setKnowledgeText}
          onUploadKnowledge={handleUploadKnowledge}
          config={config}
          guests={guests}
          transcript={transcript}
          activeGuestName={activeGuest?.name}
        />

        <ControlBar
          stageStatus={stageStatus}
          hasStarted={transcript.length > 0}
          onStart={handleStartInterview}
          onToggleMic={handleToggleListening}
          onStop={handleStop}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <SettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          config={config}
          onConfigChange={setConfig}
          guests={guests}
          onGuestsChange={setGuests}
          hostPersonaId={hostPersonaId}
          onPersonaChange={setHostPersonaId}
        />
      </div>
    </div>
  );
}
