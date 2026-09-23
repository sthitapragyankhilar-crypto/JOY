/**
 * Audio Engine - Speech Recognition (STT), Speech Synthesis (TTS),
 * and Web Audio API Visualizer frequency analyzer.
 */

export class AudioEngine {
  constructor() {
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

  async startListening({ onSpeakerTranscript, onSilenceDetected, onError, onEnd, keywords = [] }) {
    
    this.stopListening();
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

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }
      this.mediaRecorder = new MediaRecorder(this.mediaStream, options);
      
      const backendWsUrl = import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:8000";
      let url = `${backendWsUrl}/api/stt?model=nova-2&diarize=true&punctuate=true&interim_results=true&utterance_end_ms=2500`;

      if (keywords && keywords.length > 0) {
        const uniqueKeywords = [...new Set(keywords)];
        uniqueKeywords.forEach(kw => {
          url += `&keywords=${encodeURIComponent(kw)}:10`;
        });
      }
      
      this.socket = new WebSocket(url);
      
      this.socket.onopen = () => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
          this.mediaRecorder.addEventListener('dataavailable', event => {
            if (event.data.size > 0 && this.socket && this.socket.readyState === 1) {
              this.socket.send(event.data);
            }
          });
          this.mediaRecorder.start(250);
        }
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
  async speakText(text, { pitch = 1.0, rate = 1.0, ttsVoice = 'aura-asteria-en', onStart, onEnd, onError } = {}) {
    console.log(`[AUDIO DEBUG] speakText called. isSpeaking=${this.isSpeaking}, hasTtsSource=${!!this.ttsSource}`);

    // Force stop ANY previous audio
    this.stopSpeaking();

    // Basic SSML/text cleanup if needed (Deepgram mostly just takes plain text)
    const cleanText = text
      .replace(/[\*\_]/g, '')
      .replace(/\bDr\./gi, 'Doctor')
      .replace(/\bP\.?h\.?d\.?/gi, 'PhD')
      .replace(/\bJOY\b/g, 'Joy')
      .trim();
    if (!cleanText) {
       console.warn("TTS: No text to speak after cleaning.");
       if (onEnd) onEnd();
       return;
    }

    try {
      this.isSpeaking = true;
      if (onStart) onStart();

      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      let response;
      if (ttsVoice.startsWith('aura-')) {
        console.log(`TTS: Requesting Deepgram Aura (${ttsVoice}) for:`, cleanText.substring(0, 50) + "...");
        response = await fetch(`${backendUrl}/api/deepgram-tts?model=${ttsVoice}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: cleanText })
        });
      } else {
        console.log(`TTS: Requesting Edge-TTS (${ttsVoice}) for:`, cleanText.substring(0, 50) + "...");
        const formData = new FormData();
        formData.append("text", cleanText);
        formData.append("voice", ttsVoice);
        
        response = await fetch(`${backendUrl}/api/tts`, {
          method: "POST",
          body: formData
        });
      }

      if (!response.ok) {
        throw new Error(`Deepgram TTS failed: ${response.statusText}`);
      }

      // Check if we were stopped while waiting for the fetch
      if (!this.isSpeaking) {
        console.log('[AUDIO DEBUG] Was stopped during fetch, aborting playback');
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      
      this._ensureAudioContext();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Double check we weren't stopped while decoding
      if (!this.isSpeaking) {
        console.log('[AUDIO DEBUG] Was stopped during decode, aborting playback');
        return;
      }

      this.ttsSource = this.audioContext.createBufferSource();
      this.ttsSource.buffer = audioBuffer;
      this.ttsSource.connect(this.audioContext.destination);
      this.ttsSource.connect(this.analyser);
      
      this.ttsSource.onended = () => {
        console.log('[AUDIO DEBUG] ttsSource.onended fired');
        this.isSpeaking = false;
        if (onEnd) onEnd();
      };

      console.log('[AUDIO DEBUG] Starting audio playback NOW');
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
      this.ttsSource.onended = null;
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
