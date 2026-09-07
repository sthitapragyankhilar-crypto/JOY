import React from 'react';
import { Mic, MicOff, Square, Settings, Play } from 'lucide-react';

/**
 * ControlBar — Bottom-center floating circular control buttons.
 * 
 * Props:
 *  - stageStatus: string
 *  - hasStarted: boolean
 *  - onStart: () => void
 *  - onToggleMic: () => void
 *  - onStop: () => void
 *  - onOpenSettings: () => void
 */
export function ControlBar({
  stageStatus,
  hasStarted,
  onStart,
  onToggleMic,
  onStop,
  onOpenSettings
}) {
  const isListening = stageStatus === 'listening_guest';

  return (
    <div className="control-bar">
      {/* Start / Mic Toggle */}
      {!hasStarted ? (
        <button
          className="control-btn control-btn--mic"
          onClick={onStart}
          title="Start Podcast"
          aria-label="Start Podcast"
        >
          <Play size={24} />
        </button>
      ) : (
        <button
          className={`control-btn control-btn--mic ${isListening ? 'control-btn--mic-active' : ''}`}
          onClick={onToggleMic}
          title={isListening ? 'Stop listening' : 'Start speaking'}
          aria-label={isListening ? 'Stop listening' : 'Start speaking'}
        >
          {isListening ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
      )}

      {/* Stop */}
      {hasStarted && (
        <button
          className="control-btn control-btn--stop"
          onClick={onStop}
          title="Stop interview"
          aria-label="Stop interview"
        >
          <Square size={18} />
        </button>
      )}

      {/* Settings */}
      <button
        className="control-btn control-btn--settings"
        onClick={onOpenSettings}
        title="Settings"
        aria-label="Open settings"
      >
        <Settings size={20} />
      </button>
    </div>
  );
}
