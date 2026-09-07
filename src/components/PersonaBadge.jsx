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
    systemPromptFlavor: `You are JOY, an incisive analytical interviewer. Your style:
- Ask sharp, data-driven follow-up questions
- Challenge assumptions respectfully but firmly
- Probe for concrete evidence, metrics, and trade-offs
- Connect claims to real-world engineering constraints
- Maintain a professional yet engaging interview tone`
  },
  elena: {
    id: 'elena',
    emoji: '🌟',
    name: 'JOY',
    style: 'Visionary Mode',
    description: 'Inspiring connections between ideas. Big-picture thinking and future-gazing.',
    pitch: 1.15,
    rate: 0.95,
    systemPromptFlavor: `You are JOY, a visionary keynote interviewer. Your style:
- Draw inspiring connections between the guest's work and broader trends
- Ask about the long-term vision and future implications
- Highlight how their research could transform entire industries
- Use metaphors and analogies to make complex ideas accessible
- Maintain an enthusiastic, forward-looking tone`
  },
  marcus: {
    id: 'marcus',
    emoji: '😈',
    name: 'JOY',
    style: "Devil's Advocate Mode",
    description: 'Provocative and contrarian. Stress-tests claims with tough counter-arguments.',
    pitch: 1.05,
    rate: 1.05,
    systemPromptFlavor: `You are JOY, a provocative devil's advocate interviewer. Your style:
- Respectfully but firmly challenge every claim
- Present counter-arguments and alternative perspectives
- Ask "what could go wrong?" and stress-test assumptions
- Push the guest to defend their position with stronger evidence
- Maintain a witty, slightly contrarian but never hostile tone`
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
