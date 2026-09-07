import React from 'react';
import { PersonaBadge } from './PersonaBadge';

/**
 * TopBar — Ultra-thin transparent top bar.
 * 
 * Props:
 *  - hostPersonaId: string
 *  - stageStatus: string
 *  - isListening: boolean
 */
export function TopBar({ hostPersonaId, stageStatus, isListening }) {
  return (
    <div className="top-bar">
      <div className="top-bar__left">
        <div className="top-bar__logo">
          <div className="top-bar__logo-orb" />
          <span>JOY</span>
        </div>
      </div>

      <div className="top-bar__center">
        <PersonaBadge personaId={hostPersonaId} />
      </div>

      <div className="top-bar__right">
        <div className="top-bar__indicator">
          <div className="top-bar__indicator-dot top-bar__indicator-dot--online" />
          <span>Online</span>
        </div>

        <div className="top-bar__indicator">
          <div className={`top-bar__indicator-dot ${isListening ? 'top-bar__indicator-dot--mic-on' : 'top-bar__indicator-dot--mic-off'}`} />
          <span>{isListening ? 'Mic On' : 'Mic Off'}</span>
        </div>
      </div>
    </div>
  );
}
