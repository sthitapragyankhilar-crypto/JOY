import React, { useRef, useEffect, useCallback } from 'react';

/**
 * StarField — Animated deep-space background with parallax stars,
 * drifting dust, and volumetric fog.
 * 
 * Renders on a full-screen canvas behind everything.
 */
export function StarField() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const starsRef = useRef([]);
  const dustRef = useRef([]);

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

    // Generate stars
    const stars = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.08 + 0.01,
        alpha: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2,
        layer: Math.floor(Math.random() * 3), // 0=far, 1=mid, 2=near
      });
    }
    starsRef.current = stars;

    // Generate dust particles
    const dust = [];
    for (let i = 0; i < 40; i++) {
      dust.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 40 + 15,
        speed: Math.random() * 0.15 + 0.03,
        alpha: Math.random() * 0.03 + 0.01,
        drift: Math.random() * 0.3 - 0.15,
      });
    }
    dustRef.current = dust;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.style.width ? parseInt(canvas.style.width) : window.innerWidth;
    const h = canvas.style.height ? parseInt(canvas.style.height) : window.innerHeight;
    const now = performance.now() * 0.001;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Volumetric fog — soft radial gradients
    const fogGrad1 = ctx.createRadialGradient(w * 0.3, h * 0.4, 0, w * 0.3, h * 0.4, w * 0.5);
    fogGrad1.addColorStop(0, 'rgba(59, 130, 246, 0.03)');
    fogGrad1.addColorStop(1, 'transparent');
    ctx.fillStyle = fogGrad1;
    ctx.fillRect(0, 0, w, h);

    const fogGrad2 = ctx.createRadialGradient(w * 0.7, h * 0.6, 0, w * 0.7, h * 0.6, w * 0.4);
    fogGrad2.addColorStop(0, 'rgba(139, 92, 246, 0.02)');
    fogGrad2.addColorStop(1, 'transparent');
    ctx.fillStyle = fogGrad2;
    ctx.fillRect(0, 0, w, h);

    // Draw dust (behind stars)
    dustRef.current.forEach(d => {
      d.x += d.drift;
      d.y -= d.speed;

      if (d.y < -d.size) { d.y = h + d.size; d.x = Math.random() * w; }
      if (d.x < -d.size || d.x > w + d.size) { d.x = Math.random() * w; }

      const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.size);
      grad.addColorStop(0, `rgba(100, 180, 255, ${d.alpha})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(d.x - d.size, d.y - d.size, d.size * 2, d.size * 2);
    });

    // Draw stars
    starsRef.current.forEach(star => {
      const parallaxSpeed = [0.3, 0.6, 1.0][star.layer];
      star.y -= star.speed * parallaxSpeed;
      if (star.y < -2) { star.y = h + 2; star.x = Math.random() * w; }

      const twinkle = Math.sin(now * star.twinkleSpeed * 10 + star.twinkleOffset);
      const alpha = star.alpha * (0.7 + twinkle * 0.3);

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
      ctx.fill();

      // Slight glow on brighter stars
      if (star.size > 1.0) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 210, 255, ${alpha * 0.15})`;
        ctx.fill();
      }
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
