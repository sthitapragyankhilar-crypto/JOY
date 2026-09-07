import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Database, FileText, Brain, Upload, Cpu, Users } from 'lucide-react';

/**
 * MemoryPanel — Right floating glass panel for memory, context, and knowledge upload.
 * 
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - indexedDocs: string[]
 *  - knowledgeText: string
 *  - onKnowledgeTextChange: (text) => void
 *  - onUploadKnowledge: () => void
 *  - config: object
 *  - guests: array
 *  - transcript: array
 *  - activeGuestName: string
 */
export function MemoryPanel({
  isOpen,
  onClose,
  indexedDocs,
  knowledgeText,
  onKnowledgeTextChange,
  onUploadKnowledge,
  config,
  guests,
  transcript,
  activeGuestName
}) {
  const [uploadOpen, setUploadOpen] = useState(false);

  const turnCount = transcript.length;
  const hostTurns = transcript.filter(m => m.sender === 'host').length;
  const guestTurns = transcript.filter(m => m.sender === 'guest').length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="floating-panel floating-panel--right glass-card"
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          <div className="floating-panel__header">
            <div className="floating-panel__title">
              <Brain size={15} />
              Memory & Context
            </div>
            <button className="floating-panel__close" onClick={onClose} aria-label="Close memory panel">
              <X size={16} />
            </button>
          </div>

          <div className="floating-panel__body">

            {/* Knowledge Sources */}
            <div className="memory-section">
              <div className="memory-section__title">
                <FileText size={13} /> Knowledge Sources ({indexedDocs.length})
              </div>

              {indexedDocs.map((doc, idx) => (
                <div key={idx} className="memory-item">
                  <div className="memory-item__icon memory-item__icon--doc">
                    <FileText size={13} />
                  </div>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc}
                  </span>
                </div>
              ))}

              {/* Upload Toggle */}
              <button
                className="knowledge-upload__btn"
                onClick={() => setUploadOpen(!uploadOpen)}
                style={{ marginTop: '8px' }}
              >
                <Upload size={14} />
                {uploadOpen ? 'Close Upload' : 'Upload Knowledge'}
              </button>

              {uploadOpen && (
                <div className="knowledge-upload" style={{ marginTop: '10px' }}>
                  <textarea
                    rows={4}
                    value={knowledgeText}
                    onChange={e => onKnowledgeTextChange(e.target.value)}
                    placeholder="Paste guest bio, research papers, or keynote abstract..."
                  />
                  <button
                    className="knowledge-upload__btn"
                    onClick={() => {
                      onUploadKnowledge();
                      setUploadOpen(false);
                    }}
                    disabled={!knowledgeText.trim()}
                    style={{ opacity: knowledgeText.trim() ? 1 : 0.5 }}
                  >
                    <Database size={13} />
                    Index to RAG{activeGuestName ? ` (${activeGuestName})` : ''}
                  </button>
                </div>
              )}
            </div>

            {/* Conversation Memory */}
            <div className="memory-section">
              <div className="memory-section__title">
                <Brain size={13} /> Conversation Memory
              </div>

              <div className="memory-item">
                <div className="memory-item__icon memory-item__icon--memory">
                  <Brain size={13} />
                </div>
                <span>{turnCount} total turns ({hostTurns} host, {guestTurns} guest)</span>
              </div>
            </div>

            {/* Active Configuration */}
            <div className="memory-section">
              <div className="memory-section__title">
                <Cpu size={13} /> Active Configuration
              </div>

              <div className="memory-item">
                <div className="memory-item__icon memory-item__icon--config">
                  <Cpu size={13} />
                </div>
                <span>Engine: {config.engine === 'browser' ? '🌐 Browser' : config.engine === 'groq' ? '⚡ Groq' : '🦙 Ollama'}</span>
              </div>

              <div className="memory-item">
                <div className="memory-item__icon memory-item__icon--config">
                  <Users size={13} />
                </div>
                <span>{guests.length} guest{guests.length !== 1 ? 's' : ''} on panel</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
