import React from 'react';
import { WaveformVisualizer } from './WaveformVisualizer';

/**
 * GuestPanel — Renders the dynamic multi-guest stage area.
 * 
 * Props:
 *  - guests: array of guest objects
 *  - activeGuestId: string — currently selected guest
 *  - hostPersona: object — current host persona
 *  - stageStatus: string — 'idle' | 'speaking_host' | 'listening_guest' | 'thinking'
 *  - analyserNode: AnalyserNode or null
 *  - onSelectGuest: (guestId) => void
 */
export function GuestPanel({
  guests = [],
  activeGuestId,
  hostPersona,
  stageStatus,
  analyserNode,
  onSelectGuest
}) {
  const isHostSpeaking = stageStatus === 'speaking_host';
  const isListening = stageStatus === 'listening_guest';
  const isThinking = stageStatus === 'thinking';

  return (
    <div className="guest-grid">
      {/* Host Card — always first */}
      <div
        className={`guest-card guest-card--host ${isHostSpeaking ? 'guest-card--speaking' : ''}`}
      >
        <div className={`avatar-halo ${isHostSpeaking ? 'active-speaker' : ''}`}>
          <div
            className="avatar-inner guest-card__avatar"
            style={{ background: '#0f172a' }}
          >
            🤖
          </div>
        </div>
        <h3 className="guest-card__name" style={{ color: 'var(--primary-glow)' }}>
          JOY ({hostPersona?.name || 'AI Host'})
        </h3>
        <p className="guest-card__role">
          {hostPersona?.style || 'Context-Aware RAG Interviewer'}
        </p>
        <div className="guest-card__waveform">
          <WaveformVisualizer
            analyserNode={isHostSpeaking ? analyserNode : null}
            isActive={isHostSpeaking || isThinking}
            colorScheme={isHostSpeaking ? 'host' : 'idle'}
            width={100}
            height={32}
            barCount={14}
          />
        </div>
      </div>

      {/* Guest Cards */}
      {guests.map((guest) => {
        const isActive = guest.id === activeGuestId;
        const isThisGuestSpeaking = isActive && isListening;

        return (
          <div
            key={guest.id}
            className={`guest-card ${isActive ? 'guest-card--active' : ''}`}
            onClick={() => onSelectGuest(guest.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectGuest(guest.id);
              }
            }}
            title={isActive ? 'Active speaker' : 'Click to set as active speaker'}
          >
            <div className={`avatar-halo ${isThisGuestSpeaking ? 'active-user' : ''}`}>
              <div
                className="avatar-inner guest-card__avatar"
                style={{ background: guest.color || '#1e293b' }}
              >
                {guest.avatar || '👤'}
                {isActive && <div className="guest-card__active-dot" />}
              </div>
            </div>
            <h3 className="guest-card__name">{guest.name}</h3>
            <p className="guest-card__role">{guest.role}</p>
            <div className="guest-card__waveform">
              <WaveformVisualizer
                analyserNode={isThisGuestSpeaking ? analyserNode : null}
                isActive={isThisGuestSpeaking}
                colorScheme={isThisGuestSpeaking ? 'guest' : 'idle'}
                width={100}
                height={32}
                barCount={14}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
