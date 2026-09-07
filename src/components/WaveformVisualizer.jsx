import React, { useRef, useEffect, useCallback } from 'react';

/**
 * WaveformVisualizer — Canvas-based real-time audio waveform.
 * 
 * Props:
 *  - analyserNode: Web Audio AnalyserNode (nullable)
 *  - isActive: boolean — whether to animate
 *  - colorScheme: 'host' | 'guest' | 'idle'
 *  - width: number (default 120)
 *  - height: number (default 40)
 *  - barCount: number (default 16)
 */
export function WaveformVisualizer({
  analyserNode = null,
  isActive = false,
  colorScheme = 'host',
  width = 120,
  height = 40,
  barCount = 16
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const phaseRef = useRef(0);

  const COLOR_SCHEMES = {
    host: { start: '#818cf8', end: '#6366f1', glow: 'rgba(99, 102, 241, 0.3)' },
    guest: { start: '#34d399', end: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
    idle: { start: '#475569', end: '#334155', glow: 'rgba(71, 85, 105, 0.15)' },
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.idle;
    const barWidth = Math.max(2, (width / barCount) * 0.55);
    const gap = (width - barCount * barWidth) / (barCount + 1);

    let frequencyData = null;

    if (analyserNode && isActive) {
      const bufferLength = analyserNode.frequencyBinCount;
      frequencyData = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(frequencyData);
    }

    phaseRef.current += 0.04;

    for (let i = 0; i < barCount; i++) {
      let normalizedHeight;

      if (frequencyData && isActive) {
        // Map bar index to frequency data index
        const dataIndex = Math.floor((i / barCount) * frequencyData.length);
        normalizedHeight = (frequencyData[dataIndex] / 255) * (height * 0.85);
        // Add a minimum height so bars are always visible
        normalizedHeight = Math.max(3, normalizedHeight);
      } else if (isActive) {
        // Simulated waveform when active but no analyser
        const wave = Math.sin(phaseRef.current + i * 0.5) * 0.4 + 0.5;
        const secondary = Math.sin(phaseRef.current * 1.3 + i * 0.8) * 0.2;
        normalizedHeight = (wave + secondary) * height * 0.7;
        normalizedHeight = Math.max(3, normalizedHeight);
      } else {
        // Idle: subtle ambient pulse
        const wave = Math.sin(phaseRef.current * 0.5 + i * 0.4) * 0.15 + 0.2;
        normalizedHeight = wave * height * 0.4;
        normalizedHeight = Math.max(2, normalizedHeight);
      }

      const x = gap + i * (barWidth + gap);
      const y = (height - normalizedHeight) / 2;

      // Gradient per bar
      const gradient = ctx.createLinearGradient(x, y, x, y + normalizedHeight);
      gradient.addColorStop(0, colors.start);
      gradient.addColorStop(1, colors.end);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, normalizedHeight, barWidth / 2);
      ctx.fill();

      // Subtle glow
      if (isActive) {
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 4;
      }
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    animFrameRef.current = requestAnimationFrame(draw);
  }, [analyserNode, isActive, colorScheme, width, height, barCount]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [draw]);

  return (
    <div className="waveform-wrap">
      <canvas
        ref={canvasRef}
        className="waveform-canvas"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    </div>
  );
}
