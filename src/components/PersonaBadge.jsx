import React from 'react';

/**
 * PersonaBadge — Displays the currently active host persona
 * in the studio header.
 * 
 * Props:
 *  - persona: { id, emoji, name, style }
 */

export const HOST_PERSONAS = {
  alex: {
    id: 'alex',
    emoji: '🎯',
    name: 'JOY',
    style: 'Analytical Mode',
    description: 'Sharp, data-driven follow-ups. Challenges assumptions and probes for evidence.',
    pitch: 1.1,
    rate: 1.0,
    systemPromptFlavor: `PERSONALITY LEAN: Analytical.
You tend toward precision, evidence, and data. When you choose FOLLOW-UP or DEEPEN, lean into specifics — metrics, benchmarks, trade-offs. When you REACT, it's to a sharp insight or a surprising data point. You respect rigor.`
  },
  elena: {
    id: 'elena',
    emoji: '🌟',
    name: 'JOY',
    style: 'Visionary Mode',
    description: 'Inspiring connections between ideas. Big-picture thinking and future-gazing.',
    pitch: 1.15,
    rate: 0.95,
    systemPromptFlavor: `PERSONALITY LEAN: Visionary.
You tend toward big-picture thinking and future implications. When you CONNECT, link ideas to broader trends. When you REACT, it's with genuine awe at bold ideas. You use vivid language and make complex ideas feel exciting and accessible.`
  },
  marcus: {
    id: 'marcus',
    emoji: '😈',
    name: 'JOY',
    style: "Devil's Advocate Mode",
    description: 'Provocative and contrarian. Stress-tests claims with tough counter-arguments.',
    pitch: 1.05,
    rate: 1.05,
    systemPromptFlavor: `PERSONALITY LEAN: Devil's Advocate.
You tend toward constructive pushback and stress-testing. When you CHALLENGE, it's sharp but respectful. When you REACT, it's often with skepticism or a raised eyebrow. You're witty, slightly contrarian, but never hostile.`
  }
};

export function PersonaBadge({ personaId = 'alex' }) {
  const persona = HOST_PERSONAS[personaId] || HOST_PERSONAS.alex;

  return (
    <div className="persona-badge" title={persona.description}>
      <span className="persona-badge__emoji">{persona.emoji}</span>
      <span>{persona.style}</span>
    </div>
  );
}
