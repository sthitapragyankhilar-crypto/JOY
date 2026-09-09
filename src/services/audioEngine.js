/**
 * Audio Engine - Speech Recognition (STT), Speech Synthesis (TTS),
 * and Web Audio API Visualizer frequency analyzer.
 */

export class AudioEngine {
  constructor(deepgramApiKey = '') {
    this.deepgramApiKey = deepgramApiKey;
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.socket = null;
    this.mediaRecorder = null;
    this.ttsSource = null;
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
   * Speaks podcast response out loud using Deepgram Aura TTS.
   *
   * @param {string} text - Text to speak
   * @param {object} options - { pitch, rate, onStart, onEnd, onError }
   */
  async speakText(text, { pitch = 1.0, rate = 1.0, onStart, onEnd, onError } = {}) {
    if (!this.deepgramApiKey) {
      if (onError) onError("Deepgram API Key is missing for TTS.");
      return;
    }

    this.stopSpeaking();

    // Clean text of markdown/tags if any remain
    const cleanText = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/[*_#]/g, "").trim();

    if (!cleanText) {
       console.warn("TTS: No text to speak after cleaning.");
       if (onEnd) onEnd();
       return;
    }

    console.log("TTS: Requesting Deepgram Aura for:", cleanText.substring(0, 50) + "...");

    try {
      this.isSpeaking = true;
      if (onStart) onStart();

      // Deepgram Aura Asteria (female, natural)
      const response = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
        method: "POST",
        headers: {
          "Authorization": `Token ${this.deepgramApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: cleanText })
      });

      if (!response.ok) {
        throw new Error(`Deepgram TTS failed: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      this._ensureAudioContext();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.ttsSource = this.audioContext.createBufferSource();
      this.ttsSource.buffer = audioBuffer;
      this.ttsSource.connect(this.audioContext.destination);
      
      this.ttsSource.onended = () => {
        this.isSpeaking = false;
        if (onEnd) onEnd();
      };

      this.ttsSource.start(0);

    } catch (err) {
      console.error("TTS Error:", err);
      this.isSpeaking = false;
      if (onError) onError(err);
      if (onEnd) onEnd(); // gracefully recover
    }
  }

  stopSpeaking() {
    if (this.ttsSource) {
      try { this.ttsSource.stop(); } catch(e) {}
      this.ttsSource = null;
    }
    this.isSpeaking = false;
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
