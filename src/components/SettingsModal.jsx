import React, { useState, useRef, useEffect } from 'react';
import {
  Settings, X, Radio, Users, Cpu, Plus, Trash2, Edit3, Check
} from 'lucide-react';
import { HOST_PERSONAS } from './PersonaBadge';

/**
 * Guest avatar palette — auto-assigned colors and emojis.
 */
const GUEST_COLORS = [
  '#1e3a5f', '#2d1b4e', '#1a3c34', '#3d2b1f', '#1b2d4f',
  '#2b1f3d', '#1f3d2b', '#3d1f2b', '#1f2b3d', '#2b3d1f'
];

const GUEST_AVATARS = ['👤', '👩‍💼', '👨‍🔬', '👩‍🏫', '🧑‍💻', '👨‍🎓', '👩‍⚕️', '🧑‍🔧', '👨‍🎤', '👩‍🚀'];

function getNextColor(index) {
  return GUEST_COLORS[index % GUEST_COLORS.length];
}

function getNextAvatar(index) {
  return GUEST_AVATARS[index % GUEST_AVATARS.length];
}


/**
 * SettingsModal — Native <dialog> based settings panel with tabs.
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - config: { conferenceName, topic, engine, groqApiKey, ollamaModel, ollamaUrl }
 *  - onConfigChange: (newConfig) => void
 *  - guests: Guest[]
 *  - onGuestsChange: (newGuests) => void
 *  - hostPersonaId: string
 *  - onPersonaChange: (personaId) => void
 */
export function SettingsModal({
  isOpen,
  onClose,
  config,
  onConfigChange,
  guests,
  onGuestsChange,
  hostPersonaId,
  onPersonaChange
}) {
  const dialogRef = useRef(null);
  const [activeTab, setActiveTab] = useState('conference');

  // Form state for new guest
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestRole, setNewGuestRole] = useState('');
  const [newGuestBio, setNewGuestBio] = useState('');

  // Editing guest
  const [editingGuestId, setEditingGuestId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');

  // Local config copy for editing
  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Close on backdrop click
  const handleDialogClick = (e) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleAddGuest = () => {
    if (!newGuestName.trim()) return;

    const newGuest = {
      id: crypto.randomUUID(),
      name: newGuestName.trim(),
      role: newGuestRole.trim() || 'Guest Speaker',
      color: getNextColor(guests.length),
      avatar: getNextAvatar(guests.length),
      bio: newGuestBio.trim(),
      isActive: guests.length === 0 // first guest is active by default
    };

    onGuestsChange([...guests, newGuest]);
    setNewGuestName('');
    setNewGuestRole('');
    setNewGuestBio('');
  };

  const handleRemoveGuest = (guestId) => {
    const updated = guests.filter(g => g.id !== guestId);
    // If we removed the active guest, make the first one active
    if (updated.length > 0 && !updated.some(g => g.isActive)) {
      updated[0].isActive = true;
    }
    onGuestsChange(updated);
  };

  const handleStartEdit = (guest) => {
    setEditingGuestId(guest.id);
    setEditName(guest.name);
    setEditRole(guest.role);
  };

  const handleSaveEdit = (guestId) => {
    const updated = guests.map(g =>
      g.id === guestId
        ? { ...g, name: editName.trim() || g.name, role: editRole.trim() || g.role }
        : g
    );
    onGuestsChange(updated);
    setEditingGuestId(null);
  };

  const handleApply = () => {
    onConfigChange(localConfig);
    onClose();
  };

  const updateLocalConfig = (key, value) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'conference', label: 'Conference Setup', icon: <Radio size={15} /> },
    { id: 'guests', label: 'Guest Management', icon: <Users size={15} /> },
    { id: 'engine', label: 'Engine & Voice', icon: <Cpu size={15} /> },
  ];

  return (
    <dialog
      ref={dialogRef}
      className="settings-modal"
      onClick={handleDialogClick}
      onClose={onClose}
      id="settings-dialog"
    >
      {/* Header */}
      <div className="modal-header">
        <h2><Settings size={20} /> Studio Settings</h2>
        <button className="btn-ghost" onClick={onClose} aria-label="Close settings">
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-bar" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'tab-item--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="modal-body">

        {/* ---- Conference Setup Tab ---- */}
        {activeTab === 'conference' && (
          <div className="animate-fade-in">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Conference Name</label>
                <input
                  className="form-input"
                  value={localConfig.conferenceName}
                  onChange={e => updateLocalConfig('conferenceName', e.target.value)}
                  placeholder="Tech AI Summit 2026"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Main Topic</label>
                <input
                  className="form-input"
                  value={localConfig.topic}
                  onChange={e => updateLocalConfig('topic', e.target.value)}
                  placeholder="Scalable Autonomous Reasoning Agents"
                />
              </div>
            </div>

            {/* Host Persona Selector */}
            <div className="form-group" style={{ marginTop: '8px' }}>
              <label className="form-label">Host Persona</label>
              <p className="form-hint" style={{ marginBottom: '10px' }}>
                Choose JOY's interviewing personality. This changes the system prompt and voice style.
              </p>
              <div className="persona-selector">
                {Object.values(HOST_PERSONAS).map(persona => (
                  <div
                    key={persona.id}
                    className={`persona-card ${hostPersonaId === persona.id ? 'persona-card--active' : ''}`}
                    onClick={() => onPersonaChange(persona.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPersonaChange(persona.id);
                      }
                    }}
                  >
                    <div className="persona-card__emoji">{persona.emoji}</div>
                    <div className="persona-card__name">{persona.name}</div>
                    <div className="persona-card__style">{persona.style}</div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                      {persona.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---- Guest Management Tab ---- */}
        {activeTab === 'guests' && (
          <div className="animate-fade-in">
            {/* Add Guest Form */}
            <div style={{
              padding: '16px',
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Add New Guest
              </h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Guest Name</label>
                  <input
                    className="form-input"
                    value={newGuestName}
                    onChange={e => setNewGuestName(e.target.value)}
                    placeholder="Dr. Sarah Lin"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddGuest(); }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Role / Title</label>
                  <input
                    className="form-input"
                    value={newGuestRole}
                    onChange={e => setNewGuestRole(e.target.value)}
                    placeholder="VP of AI Research"
                    onKeyDown={e => { if (e.key === 'Enter') handleAddGuest(); }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Bio / Background (Optional — fed to RAG)</label>
                <textarea
                  className="form-input"
                  value={newGuestBio}
                  onChange={e => setNewGuestBio(e.target.value)}
                  placeholder="Paste guest bio, research background, or keynote abstract..."
                  rows={3}
                />
              </div>
              <button
                className="btn-primary"
                onClick={handleAddGuest}
                disabled={!newGuestName.trim()}
                style={{ opacity: newGuestName.trim() ? 1 : 0.5 }}
              >
                <Plus size={16} /> Add Guest to Panel
              </button>
            </div>

            {/* Current Guests List */}
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>
              CURRENT GUESTS ({guests.length})
            </h4>

            {guests.length === 0 && (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-dim)',
                fontSize: '0.85rem',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border)'
              }}>
                No guests added yet. Add your first guest above!
              </div>
            )}

            {guests.map((guest) => (
              <div key={guest.id} className="guest-list-item">
                <div
                  className="guest-list-avatar"
                  style={{ background: guest.color }}
                >
                  {guest.avatar}
                </div>
                <div className="guest-list-info">
                  {editingGuestId === guest.id ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        className="form-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(guest.id); }}
                      />
                      <input
                        className="form-input"
                        value={editRole}
                        onChange={e => setEditRole(e.target.value)}
                        style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(guest.id); }}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="guest-list-name">{guest.name}</div>
                      <div className="guest-list-role">{guest.role}</div>
                    </>
                  )}
                </div>
                <div className="guest-list-actions">
                  {editingGuestId === guest.id ? (
                    <button
                      className="btn-icon"
                      onClick={() => handleSaveEdit(guest.id)}
                      title="Save changes"
                    >
                      <Check size={14} />
                    </button>
                  ) : (
                    <button
                      className="btn-icon"
                      onClick={() => handleStartEdit(guest)}
                      title="Edit guest"
                    >
                      <Edit3 size={14} />
                    </button>
                  )}
                  <button
                    className="btn-icon btn-icon--danger"
                    onClick={() => handleRemoveGuest(guest.id)}
                    title="Remove guest"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---- Engine & Voice Tab ---- */}
        {activeTab === 'engine' && (
          <div className="animate-fade-in">
            <div className="form-group">
              <label className="form-label">Reasoning Engine</label>
              <p className="form-hint" style={{ marginBottom: '10px' }}>
                Choose how JOY generates responses. Browser mode works offline with heuristic responses.
              </p>
              <div className="radio-group">
                {[
                  { id: 'browser', label: '🌐 Browser (Free, Offline)' },
                  { id: 'groq', label: '⚡ Groq API (Fast, Free Tier)' },
                  { id: 'ollama', label: '🦙 Local Ollama (Private)' },
                ].map(opt => (
                  <div
                    key={opt.id}
                    className={`radio-option ${localConfig.engine === opt.id ? 'radio-option--active' : ''}`}
                    onClick={() => updateLocalConfig('engine', opt.id)}
                    role="radio"
                    aria-checked={localConfig.engine === opt.id}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        updateLocalConfig('engine', opt.id);
                      }
                    }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Groq API Key */}
            {localConfig.engine === 'groq' && (
              <div className="form-group animate-fade-in">
                <label className="form-label">Groq API Key</label>
                <input
                  className="form-input"
                  type="password"
                  value={localConfig.groqApiKey}
                  onChange={e => updateLocalConfig('groqApiKey', e.target.value)}
                  placeholder="gsk_your_groq_api_key_here"
                />
                <p className="form-hint">
                  Get a free key at <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>console.groq.com</a>
                </p>
              </div>
            )}

            {/* Ollama Settings */}
            {localConfig.engine === 'ollama' && (
              <div className="animate-fade-in">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ollama Model</label>
                    <input
                      className="form-input"
                      value={localConfig.ollamaModel}
                      onChange={e => updateLocalConfig('ollamaModel', e.target.value)}
                      placeholder="llama3.2"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ollama URL</label>
                    <input
                      className="form-input"
                      value={localConfig.ollamaUrl}
                      onChange={e => updateLocalConfig('ollamaUrl', e.target.value)}
                      placeholder="http://localhost:11434"
                    />
                  </div>
                </div>
                <p className="form-hint">
                  Make sure Ollama is running locally. Install from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>ollama.com</a>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="modal-footer">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleApply}>
          Apply Settings
        </button>
      </div>
    </dialog>
  );
}
