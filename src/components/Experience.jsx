import React, { useRef, useEffect } from 'react';

export function Starfield2D({ handData, isAudioActive, onMusicReady }) {
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const pinkTextureRef = useRef(null);
  const starsRef = useRef([]);
  const lastHandPos = useRef({ x: 0.5, y: 0.5 });
  
  // Audio Refs
  const audioCtxRef = useRef(null);
  const audioElementsRef = useRef({ left: null, right: null });
  const pannersRef = useRef({ left: null, right: null });
  const gainsRef = useRef({ left: null, right: null });
  const masterFilterRef = useRef(null);

  // 1. Initialize Stars and Textures
  useEffect(() => {
    const starCount = 1500; // Increased for a fuller universe
    const newStars = [];
    for (let i = 0; i < starCount; i++) {
      const initialX = Math.random();
      const initialY = Math.random();
      const z = Math.random() * 0.9 + 0.1;
      newStars.push({
        x: initialX, y: initialY,
        ox: initialX, oy: initialY,
        z: z, // Depth (0.1: Far, 1.0: Near)
        size: Math.random() * 3 + 0.5,
        speed: Math.random() * 0.0001 + 0.00005,
        vx: 0, vy: 0,
        colorType: initialX < 0.5 ? 'pink' : 'white',
        mass: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.001 + Math.random() * 0.004 // Individual pulse speed
      });
    }
    starsRef.current = newStars;

    const img = new Image();
    img.src = '/star.png';
    img.onload = () => {
      const processTexture = (color = null) => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width; offCanvas.height = img.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(img, 0, 0);
        const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
          if (color) { data[i] = color.r; data[i+1] = color.g; data[i+2] = color.b; }
          data[i+3] = brightness;
        }
        offCtx.putImageData(imageData, 0, 0);
        const newImg = new Image();
        newImg.src = offCanvas.toDataURL();
        return newImg;
      };
      textureRef.current = processTexture();
      pinkTextureRef.current = processTexture({ r: 255, g: 0, b: 127 });
    };
  }, []);

  // 2. Initialize Audio (Dynamic Filter & Advanced Mixing)
  useEffect(() => {
    if (!isAudioActive) return;

    const initAudio = async () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Master Filter (Muffled Effect)
      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 800; // Start muffled
      masterFilter.connect(ctx.destination);
      masterFilterRef.current = masterFilter;

      const createTrack = (url, initialPan) => {
        const audio = new Audio(url);
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 0; // Start silent
        
        const panner = ctx.createStereoPanner();
        panner.pan.value = initialPan;

        source.connect(gain);
        gain.connect(panner);
        panner.connect(masterFilter); // Connect to master filter
        
        return { audio, panner, gain };
      };

      const marsUrl = '/Rosewood_vocal_left.mp3';
      const venusUrl = '/Rosewood_drum_right.mp3';

      const left = createTrack(marsUrl, -1);
      const right = createTrack(venusUrl, 1);

      audioElementsRef.current = { left: left.audio, right: right.audio };
      pannersRef.current = { left: left.panner, right: right.panner };
      gainsRef.current = { left: left.gain, right: right.gain };

      const startPlayback = async () => {
        try {
          if (ctx.state === 'suspended') await ctx.resume();
          await Promise.all([left.audio.play(), right.audio.play()]);
          if (onMusicReady) onMusicReady();
        } catch (err) {
          if (onMusicReady) onMusicReady();
        }
      };

      let readyCount = 0;
      const checkStatus = () => { if (readyCount > 0) startPlayback(); };
      left.audio.oncanplay = () => { readyCount++; checkStatus(); };
      right.audio.oncanplay = () => { readyCount++; checkStatus(); };
      if (left.audio.readyState >= 2 || right.audio.readyState >= 2) startPlayback();
    };

    initAudio();

    return () => {
      if (audioElementsRef.current.left) {
        audioElementsRef.current.left.pause();
        audioElementsRef.current.right.pause();
      }
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [isAudioActive]);

  // 3. Render Loop
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
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      let hX = 0, hY = 0, hScaling = 0;
      let handVX = 0, handVY = 0;
      let normHandX = 0.5;

      if (handData) {
        normHandX = (1 - handData.x); // Current hand X (0: Left, 1: Right)
        hX = normHandX * width;
        hY = handData.y * height;
        hScaling = (handData.scale || 0.5) * 450;
        handVX = (hX - lastHandPos.current.x) * 0.25;
        handVY = (hY - lastHandPos.current.y) * 0.25;
        lastHandPos.current = { x: hX, y: hY };
      }

      const stars = starsRef.current;
      let totalDisplacement = 0;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        if (handData) {
          const dx = (star.x * width) - hX;
          const dy = (star.y * height) - hY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < hScaling) {
            const forceFactor = Math.pow(1 - dist / hScaling, 1.5);
            
            // 1. Repulsion (Scattering away from hand)
            const repelX = (dx / dist) * 0.15;
            const repelY = (dy / dist) * 0.15;
            
            // 2. Vortex (Swirling around hand)
            const swirlX = (-dy / dist) * 0.25;
            const swirlY = (dx / dist) * 0.25;
            
            // 3. Direct Velocity (Reduced drag)
            const dragX = handVX * 0.15;
            const dragY = handVY * 0.15;
            
            // Combine based on individual mass and depth (Parallax)
            // Farther stars (low Z) react less to the hand
            const depthFactor = star.z;
            star.vx += (repelX + swirlX + dragX) * forceFactor * (1 / star.mass) * depthFactor;
            star.vy += (repelY + swirlY + dragY) * forceFactor * (1 / star.mass) * depthFactor;
            
            // Add a little 'shimmer' jitter
            star.vx += Math.sin(Date.now() * 0.01 + star.phase) * 0.03;
            star.vy += Math.cos(Date.now() * 0.01 + star.phase) * 0.03;
          }
        }

        const springPower = 0.00015; // Much weaker 'magnet' force
        star.vx += (star.ox - star.x) * springPower * width;
        star.vy += (star.oy - star.y) * springPower * height;
        star.x += star.vx / width;
        star.y += star.vy / height;
        
        // Lower friction (0.93) to allow longer drifting
        star.vx *= 0.93;
        star.vy *= 0.93;

        totalDisplacement += Math.sqrt(Math.pow(star.x - star.ox, 2) + Math.pow(star.y - star.oy, 2));

        const sx = star.x * width;
        const sy = star.y * height;
        
        // Twinkle Logic: Pulsing opacity and size
        const twinkle = Math.sin(Date.now() * star.twinkleSpeed + star.phase * 10);
        const sSize = star.size * star.z * 6 * (0.85 + twinkle * 0.15);
        
        const currentTex = star.colorType === 'pink' ? pinkTextureRef.current : textureRef.current;
        if (currentTex && currentTex.complete) {
          // Opacity also twinkles slightly
          ctx.globalAlpha = star.z * (0.7 + twinkle * 0.3);
          ctx.drawImage(currentTex, sx - sSize / 2, sy - sSize / 2, sSize, sSize);
        }
      }

      // --- Advanced Audio Interaction (Centroid Based) ---
      if (audioCtxRef.current && masterFilterRef.current) {
        const curTime = audioCtxRef.current.currentTime;
        
        // 1. Calculate Centroids (Center of Mass) for each group
        let sumXPink = 0, countPink = 0;
        let sumXWhite = 0, countWhite = 0;
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          if (s.colorType === 'pink') {
            sumXPink += s.x;
            countPink++;
          } else {
            sumXWhite += s.x;
            countWhite++;
          }
        }
        const avgXPink = sumXPink / (countPink || 1);
        const avgXWhite = sumXWhite / (countWhite || 1);

        // 2. Muffled Filter based on Hand Visibility (Stays smooth)
        const targetFreq = handData ? 20000 : 800;
        masterFilterRef.current.frequency.setTargetAtTime(targetFreq, curTime, 0.4);

        // 3. Distribution Based Volume (90:10 Rule)
        if (gainsRef.current.left) {
          // Pink Star (Vocal): Left(0) gives max gain, Right(1) gives min gain
          const gainPink = 0.1 + (1 - avgXPink) * 0.8;
          // White Star (Drum): Right(1) gives max gain, Left(0) gives min gain
          const gainWhite = 0.1 + avgXWhite * 0.8;

          // Global chaos boost (still adds excitement when mixed)
          const avgDisplacement = totalDisplacement / stars.length;
          const chaosBoost = Math.min(avgDisplacement * 5, 0.3);

          gainsRef.current.left.gain.setTargetAtTime(gainPink + chaosBoost, curTime, 0.2);
          gainsRef.current.right.gain.setTargetAtTime(gainWhite + chaosBoost, curTime, 0.2);

          // 4. Stereo Panning follows the stars
          const panPink = (avgXPink * 2) - 1; // Map 0..1 to -1..1
          const panWhite = (avgXWhite * 2) - 1;
          pannersRef.current.left.pan.setTargetAtTime(panPink, curTime, 0.2);
          pannersRef.current.right.pan.setTargetAtTime(panWhite, curTime, 0.2);
        }
      }

      ctx.globalAlpha = 1.0;
      if (handData) {
        const gradient = ctx.createRadialGradient(hX, hY, 0, hX, hY, hScaling);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(hX, hY, hScaling, 0, Math.PI * 2); ctx.fill();
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
    <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', display: 'block' }} />
  );
}
