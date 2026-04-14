import React, { useRef, useEffect } from 'react';

export function Starfield2D({ handData }) {
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const pinkTextureRef = useRef(null);
  const starsRef = useRef([]);
  const lastHandPos = useRef({ x: 0.5, y: 0.5 });

  // 1. Initialize Stars with Physics Properties and Home Position
  useEffect(() => {
    const starCount = 600;
    const newStars = [];
    for (let i = 0; i < starCount; i++) {
      const initialX = Math.random();
      const initialY = Math.random();
      newStars.push({
        x: initialX,
        y: initialY,
        ox: initialX, // Original Home X
        oy: initialY, // Original Home Y
        z: Math.random() * 0.8 + 0.2,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.0001 + 0.00005, // Slower base speed for home logic
        vx: 0,
        vy: 0,
        // Left side stars are Pink, Right side are White
        colorType: initialX < 0.5 ? 'pink' : 'white'
      });
    }
    starsRef.current = newStars;

    // Pre-load textures
    const img = new Image();
    img.src = '/star.png';
    img.onload = () => {
      // Create transparent versions of textures by using brightness as alpha
      const processTexture = (color = null) => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width;
        offCanvas.height = img.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(img, 0, 0);
        
        const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          const brightness = (r + g + b) / 3;
          
          if (color) {
            data[i] = color.r;
            data[i+1] = color.g;
            data[i+2] = color.b;
          }
          data[i+3] = brightness; // Set alpha based on brightness
        }
        offCtx.putImageData(imageData, 0, 0);
        const newImg = new Image();
        newImg.src = offCanvas.toDataURL();
        return newImg;
      };

      textureRef.current = processTexture(); // Pure white with alpha
      pinkTextureRef.current = processTexture({ r: 255, g: 0, b: 127 }); // Neon Pink with alpha
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

      // Hand Physics
      let handVX = 0;
      let handVY = 0;
      let hX = 0;
      let hY = 0;
      let hScaling = 0;

      if (handData) {
        hX = (1 - handData.x) * width;
        hY = handData.y * height;
        hScaling = (handData.scale || 0.5) * 450;
        handVX = (hX - lastHandPos.current.x) * 0.25;
        handVY = (hY - lastHandPos.current.y) * 0.25;
        lastHandPos.current = { x: hX, y: hY };
      }

      const stars = starsRef.current;
      const whiteTex = textureRef.current;
      const pinkTex = pinkTextureRef.current;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // 1. Interaction (Pushing/Mixing)
        if (handData) {
          const dx = (star.x * width) - hX;
          const dy = (star.y * height) - hY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < hScaling) {
            const force = (1 - dist / hScaling) * 0.6;
            star.vx += handVX * force;
            star.vy += handVY * force;
            star.vx += (Math.random() - 0.5) * 0.02;
            star.vy += (Math.random() - 0.5) * 0.02;
          }
        }

        // 2. Return to Home Logic (Spring Force) - Slowed down
        const springX = (star.ox - star.x) * 0.0006;
        const springY = (star.oy - star.y) * 0.0006;
        star.vx += springX * width;
        star.vy += springY * height;

        // 3. Physics Update
        star.x += star.vx / width;
        star.y += star.vy / height;

        // Friction (Higher friction for more stability returning home)
        star.vx *= 0.92;
        star.vy *= 0.92;

        // 4. Draw with Fixed Color
        const sx = star.x * width;
        const sy = star.y * height;
        const sSize = star.size * star.z * 6;

        const currentTex = star.colorType === 'pink' ? pinkTex : whiteTex;

        if (currentTex && currentTex.complete) {
          ctx.globalAlpha = star.z;
          ctx.drawImage(currentTex, sx - sSize / 2, sy - sSize / 2, sSize, sSize);
        }
      }
      ctx.globalAlpha = 1.0;

      // Hand Light
      if (handData) {
        const gradient = ctx.createRadialGradient(hX, hY, 0, hX, hY, hScaling);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
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
