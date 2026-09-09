/**
 * Audio Engine - Speech Recognition (STT), Speech Synthesis (TTS),
 * and Web Audio API Visualizer frequency analyzer.
 */

export class AudioEngine {
  constructor(deepgramApiKey = '') {
    this.deepgramApiKey = deepgramApiKey;
    this.synthesis = window.speechSynthesis;
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.voices = [];
    this.selectedVoice = null;
    this.socket = null;
    this.mediaRecorder = null;

    this._initSpeechSynthesis();
  }

  // Native SpeechRecognition is removed in favor of Deepgram

  _initSpeechSynthesis() {
    if (!this.synthesis) return;

    const loadVoices = () => {
      this.voices = this.synthesis.getVoices();
      // Prefer feminine english voices for JOY
      this.selectedVoice = this.voices.find(v =>
        v.lang.startsWith("en") &&
        (v.name.includes("Samantha") || v.name.includes("Karen") || v.name.includes("Zira") ||
         v.name.includes("Female") || v.name.includes("Ava") || v.name.includes("Allison") ||
         v.name.includes("Fiona") || v.name.includes("Victoria") || v.name.includes("Tessa"))
      ) || this.voices.find(v =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Enhanced"))
      ) || this.voices.find(v => v.lang.startsWith("en")) || this.voices[0];
    };

    loadVoices();
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Returns the current AnalyserNode for waveform visualization.
   * May be null if mic hasn't been activated yet.
   */
  getAnalyserNode() {
    return this.analyser;
  }

  /**
   * Ensures an AudioContext and AnalyserNode exist (reuses if already created).
   */
  _ensureAudioContext() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioCtx();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;
  }

  async startListening({ onSpeakerTranscript, onSilenceDetected, onError, onEnd }) {
    if (!this.deepgramApiKey) {
      if (onError) onError("Deepgram API Key is missing. Please add it in settings.");
      return;
    }
    
    this.isListening = true;

    try {
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      this._ensureAudioContext();
      
      try {
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        source.connect(this.analyser);
      } catch (e) {
        // Ignored if already connected
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: 'audio/webm' });
      
      const url = 'wss://api.deepgram.com/v1/listen?diarize=true&punctuate=true&interim_results=true&utterance_end_ms=2500';
      this.socket = new WebSocket(url, ['token', this.deepgramApiKey]);
      
      this.socket.onopen = () => {
        this.mediaRecorder.addEventListener('dataavailable', event => {
          if (event.data.size > 0 && this.socket.readyState === 1) {
            this.socket.send(event.data);
          }
        });
        this.mediaRecorder.start(250);
      };

      this.socket.onmessage = (message) => {
        const received = JSON.parse(message.data);
        if (received.type === 'Results') {
          const transcript = received.channel.alternatives[0].transcript;
          const words = received.channel.alternatives[0].words;
          
          if (transcript && onSpeakerTranscript) {
            let currentSpeaker = words.length > 0 && words[0].speaker !== undefined ? words[0].speaker : 0;
            const isFinal = received.is_final;
            onSpeakerTranscript(currentSpeaker, isFinal ? '' : transcript, isFinal ? transcript : '');
          }
        } else if (received.type === 'UtteranceEnd') {
          if (onSilenceDetected) onSilenceDetected();
        }
      };

      this.socket.onclose = () => {
        if (this.isListening && onEnd) onEnd();
      };
      
      this.socket.onerror = (e) => {
        console.error("Deepgram WebSocket Error", e);
        if (onError) onError("Deepgram WebSocket Error");
      }

    } catch (e) {
      console.error("Mic error:", e);
      if (onError) onError(e.message);
    }
  }

  stopListening() {
    this.isListening = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch(e) {}
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    // Do NOT stop the mic visualizer/stream here, keep the hardware mic hot for the next turn
  }

  /**
   * Speaks podcast response out loud with persona-aware voice settings.
   *
   * @param {string} text - Text to speak
   * @param {object} options - { pitch, rate, onStart, onEnd, onError }
   */
  speakText(text, { pitch = 1.0, rate = 1.0, onStart, onEnd, onError } = {}) {
    if (!this.synthesis) {
      if (onError) onError("Speech Synthesis not supported");
      return;
    }

    // Cancel any active speech
    this.synthesis.cancel();

    // Clean text of markdown/tags if any remain
    const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/[*_#]/g, "").trim();

    if (!cleanText) {
       console.warn("TTS: No text to speak after cleaning.");
       if (onEnd) onEnd();
       return;
    }

    // Small delay after cancel to prevent Chrome SpeechSynthesis bug
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.voice = this.selectedVoice;
      utterance.pitch = pitch;
      utterance.rate = rate;

      utterance.onstart = () => {
        this.isSpeaking = true;
        if (onStart) onStart();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        if (onEnd) onEnd();
      };

      utterance.onerror = (e) => {
        this.isSpeaking = false;
        console.warn("Speech Synthesis Utterance Error:", e);
        if (onError) onError(e);
      };

      this.synthesis.speak(utterance);
    }, 50);
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
  }

  /**
   * Web Audio API Microphone Visualizer.
   * Reuses existing AudioContext if available.
   */
  async startMicVisualizer() {
    try {
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      this._ensureAudioContext();

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
    } catch (e) {
      console.warn("Mic visualizer unavailable:", e);
    }
  }

  stopMicVisualizer() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    // Don't close AudioContext here — it can be reused
  }

  /**
   * Full cleanup — call on unmount or full stop.
   */
  destroy() {
    this.stopListening();
    this.stopSpeaking();
    this.stopMicVisualizer();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }
  }
}
