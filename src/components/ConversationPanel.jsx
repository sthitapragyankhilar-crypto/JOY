import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Search } from 'lucide-react';

/**
 * ConversationPanel — Left floating glass panel for conversation timeline.
 * 
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - transcript: array of message objects
 *  - guestText: string — current interim text while listening
 *  - stageStatus: string
 */
export function ConversationPanel({ isOpen, onClose, transcript, guestText, stageStatus }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="floating-panel floating-panel--left glass-card"
          initial={{ x: -380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -380, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <div className="floating-panel__header">
            <div className="floating-panel__title">
              <MessageSquare size={15} />
              Conversation
            </div>
            <button className="floating-panel__close" onClick={onClose} aria-label="Close conversation panel">
              <X size={16} />
            </button>
          </div>

          <div className="floating-panel__body" ref={scrollRef}>
            {transcript.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px 16px',
                color: 'var(--text-dim)',
                fontSize: '0.82rem',
              }}>
                Start the podcast to see the conversation here.
              </div>
            )}

            {transcript.map((msg, index) => (
              <div key={index} className="conv-message">
                <div className="conv-message__header">
                  <div className={`conv-message__avatar ${msg.sender === 'host' ? 'conv-message__avatar--host' : 'conv-message__avatar--guest'}`}>
                    {msg.sender === 'host' ? '🤖' : '👤'}
                  </div>
                  <span className={`conv-message__name ${msg.sender === 'host' ? 'conv-message__name--host' : 'conv-message__name--guest'}`}>
                    {msg.name}
                  </span>
                  <span className="conv-message__time">{msg.time}</span>
                </div>
                <p className="conv-message__text">{msg.text}</p>
              </div>
            ))}

            {/* Live interim text */}
            {stageStatus === 'listening_guest' && guestText && (
              <div className="conv-message" style={{ opacity: 0.6 }}>
                <div className="conv-message__header">
                  <div className="conv-message__avatar conv-message__avatar--guest">👤</div>
                  <span className="conv-message__name conv-message__name--guest" style={{ fontStyle: 'italic' }}>
                    Speaking...
                  </span>
                </div>
                <p className="conv-message__text" style={{ fontStyle: 'italic' }}>{guestText}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
