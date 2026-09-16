import React, { useRef, useEffect, useCallback } from 'react';

/**
 * AuroraBackground — Replaces StarField with a smooth, deep purple/magenta 
 * fluid aurora background matching the user's reference image.
 */
export function StarField() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const orbsRef = useRef([]);

  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Create a few large, slow-moving color orbs for the aurora effect
    orbsRef.current = [
      {
        x: w * 0.3, y: h * 0.2,
        vx: 0.2, vy: 0.15,
        radius: Math.max(w, h) * 0.6,
        color: 'rgba(100, 20, 180, 0.14)' // Deep violet
      },
      {
        x: w * 0.7, y: h * 0.8,
        vx: -0.15, vy: -0.2,
        radius: Math.max(w, h) * 0.65,
        color: 'rgba(170, 50, 200, 0.10)' // Magenta/purple
      },
      {
        x: w * 0.5, y: h * 0.5,
        vx: 0.1, vy: -0.1,
        radius: Math.max(w, h) * 0.5,
        color: 'rgba(80, 30, 140, 0.12)' // Dark purple
      },
      {
        x: w * 0.8, y: h * 0.3,
        vx: -0.05, vy: 0.1,
        radius: Math.max(w, h) * 0.4,
        color: 'rgba(200, 60, 180, 0.08)' // Pink/Fuchsia
      }
    ];
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.style.width ? parseInt(canvas.style.width) : window.innerWidth;
    const h = canvas.style.height ? parseInt(canvas.style.height) : window.innerHeight;

    // Clear with dark base
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    // Update and draw orbs
    orbsRef.current.forEach(orb => {
      // Drift
      orb.x += orb.vx;
      orb.y += orb.vy;

      // Bounce off invisible bounds (slightly outside screen)
      if (orb.x < -w * 0.2 || orb.x > w * 1.2) orb.vx *= -1;
      if (orb.y < -h * 0.2 || orb.y > h * 1.2) orb.vy *= -1;

      // Draw radial gradient
      const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
      grad.addColorStop(0, orb.color);
      grad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    });

    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    init();
    animRef.current = requestAnimationFrame(draw);

    const handleResize = () => init();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [init, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="ai-interface__canvas-bg"
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
