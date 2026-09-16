import React from 'react';
import { PersonaBadge } from './PersonaBadge';
import { Logo } from './Logo';

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
          <Logo width={24} height={24} className="top-bar__logo-svg" />
          <span>JOY</span>
        </div>
      </div>

      <div className="top-bar__center">
        {/* Mode badge removed as requested */}
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
