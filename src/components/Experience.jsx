import React, { useRef, useEffect } from 'react';

export function Starfield2D({ handData }) {
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const blackTextureRef = useRef(null);
  const starsRef = useRef([]);
  const lastHandPos = useRef({ x: 0.5, y: 0.5 });

  // 1. Initialize Stars with Physics Properties
  useEffect(() => {
    const starCount = 600;
    const newStars = [];
    for (let i = 0; i < starCount; i++) {
      newStars.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random() * 0.8 + 0.2,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.0002 + 0.0001,
        vx: 0,
        vy: 0
      });
    }
    starsRef.current = newStars;

    // Pre-load textures
    const img = new Image();
    img.src = '/star.png';
    img.onload = () => {
      textureRef.current = img;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(img, 0, 0);
      offCtx.globalCompositeOperation = 'source-in';
      offCtx.fillStyle = 'black';
      offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
      const blackImg = new Image();
      blackImg.src = offCanvas.toDataURL();
      blackTextureRef.current = blackImg;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    let animationFrameId;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const render = () => {
      // Background
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, width / 2, height);
      ctx.fillStyle = '#000000';
      ctx.fillRect(width / 2, 0, width / 2, height);

      // Hand Physics calculation
      let handVX = 0;
      let handVY = 0;
      let hX = 0;
      let hY = 0;
      let hScaling = 0;

      if (handData) {
        hX = (1 - handData.x) * width; // Mirrored
        hY = handData.y * height;
        hScaling = (handData.scale || 0.5) * 400;

        // Calculate hand velocity
        handVX = (hX - lastHandPos.current.x) * 0.2;
        handVY = (hY - lastHandPos.current.y) * 0.2;
        lastHandPos.current = { x: hX, y: hY };
      }

      const stars = starsRef.current;
      const whiteTex = textureRef.current;
      const blackTex = blackTextureRef.current;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // 1. Interaction Logic (Mixing)
        if (handData) {
          const dx = (star.x * width) - hX;
          const dy = (star.y * height) - hY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < hScaling) {
            // Push star in the direction of hand movement
            const force = (1 - dist / hScaling) * 0.5;
            star.vx += handVX * force;
            star.vy += handVY * force;
            
            // Add a little swirl/jitter
            star.vx += (Math.random() - 0.5) * 0.01;
            star.vy += (Math.random() - 0.5) * 0.01;
          }
        }

        // 2. Physics Update
        star.x += star.vx / width;
        star.y += (star.speed * star.z) + (star.vy / height);

        // Friction
        star.vx *= 0.94;
        star.vy *= 0.94;

        // 3. Screen Bounds (Wrap around)
        if (star.y > 1) { star.y = 0; star.vy = 0; }
        if (star.y < 0) { star.y = 1; star.vy = 0; }
        if (star.x > 1) { star.x = 0; star.vx = 0; }
        if (star.x < 0) { star.x = 1; star.vx = 0; }

        // 4. Draw
        const sx = star.x * width;
        const sy = star.y * height;
        const sSize = star.size * star.z * 5;

        const isRight = sx > width / 2;
        const currentTex = isRight ? whiteTex : blackTex;

        if (currentTex && currentTex.complete) {
          ctx.globalAlpha = star.z;
          ctx.drawImage(currentTex, sx - sSize / 2, sy - sSize / 2, sSize, sSize);
        }
      }
      ctx.globalAlpha = 1.0;

      // Draw Hand Light
      if (handData) {
        const gradient = ctx.createRadialGradient(hX, hY, 0, hX, hY, hScaling);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(hX, hY, hScaling, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [handData]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'block'
      }}
    />
  );
}
