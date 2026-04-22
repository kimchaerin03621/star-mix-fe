import React, { useRef, useEffect } from 'react';

export function Starfield2D({ handData, isAudioActive, onMusicReady, activePreset, activeSong, songTrigger, leftRate, rightRate }) {
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const pinkTextureRef = useRef(null);
  const starsRef = useRef([]);
  const lastHandPos = useRef({ x: 0.5, y: 0.5 });
  const lastPreset = useRef(activePreset);
  
  // Audio Refs
  const audioCtxRef = useRef(null);
  const audioElementsRef = useRef({ left: null, right: null });
  const pannersRef = useRef({ left: null, right: null });
  const gainsRef = useRef({ left: null, right: null });
  const eqFiltersRef = useRef({ low: null, mid: null, high: null });
  const masterFilterRef = useRef(null);

  // 1. Initialize Stars and Textures
  useEffect(() => {
    const starCount = 1500;
    const newStars = [];
    for (let i = 0; i < starCount; i++) {
      const initialX = Math.random();
      const initialY = Math.random();
      const z = Math.random() * 0.9 + 0.1;
      newStars.push({
        x: initialX, y: initialY,
        ox: initialX, oy: initialY,
        z: z,
        size: Math.random() * 3 + 0.5,
        speed: Math.random() * 0.0001 + 0.00005,
        vx: 0, vy: 0,
        colorType: initialX < 0.5 ? 'pink' : 'white',
        mass: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.001 + Math.random() * 0.004
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

  // 2. Initialize Audio
  useEffect(() => {
    if (!isAudioActive) return;

    const initAudio = async () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 20000;
      masterFilter.connect(ctx.destination);
      masterFilterRef.current = masterFilter;

      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 250;
      lowShelf.gain.value = 0;

      const midPeaking = ctx.createBiquadFilter();
      midPeaking.type = 'peaking';
      midPeaking.frequency.value = 1000;
      midPeaking.Q.value = 0.7;
      midPeaking.gain.value = 0;

      const highShelf = ctx.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 5000;
      highShelf.gain.value = 0;

      lowShelf.connect(midPeaking);
      midPeaking.connect(highShelf);
      highShelf.connect(masterFilter);
      eqFiltersRef.current = { low: lowShelf, mid: midPeaking, high: highShelf };

      const createTrack = (url, initialPan) => {
        const audio = new Audio(url);
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        audio.preservesPitch = true;
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 0;
        const panner = ctx.createStereoPanner();
        panner.pan.value = initialPan;
        source.connect(gain);
        gain.connect(panner);
        panner.connect(lowShelf);
        return { audio, panner, gain };
      };

      const songMap = {
        1: { vocal: '/Rosewood_vocal_left.mp3', drum: '/Rosewood_drum_right.mp3' },
        2: { vocal: '/00_left.mp3', drum: '/gangnamstyle_right.mp3' },
        3: { vocal: '/Rosewood_vocal_left.mp3', drum: '/Rosewood_drum_right.mp3' },
      };
      const { vocal, drum } = songMap[activeSong] || songMap[1];

      const left = createTrack(vocal, -1);
      const right = createTrack(drum, 1);

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
  }, [isAudioActive, activeSong, songTrigger]); // Added songTrigger here

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
        normHandX = (1 - handData.x);
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
            const repelX = (dx / dist) * 0.15;
            const repelY = (dy / dist) * 0.15;
            const swirlX = (-dy / dist) * 0.25;
            const swirlY = (dx / dist) * 0.25;
            const dragX = handVX * 0.15;
            const dragY = handVY * 0.15;
            const depthFactor = star.z;
            star.vx += (repelX + swirlX + dragX) * forceFactor * (1 / star.mass) * depthFactor;
            star.vy += (repelY + swirlY + dragY) * forceFactor * (1 / star.mass) * depthFactor;
            star.vx += Math.sin(Date.now() * 0.01 + star.phase) * 0.03;
            star.vy += Math.cos(Date.now() * 0.01 + star.phase) * 0.03;
          }
        }
        const springPower = 0.00015;
        star.vx += (star.ox - star.x) * springPower * width;
        star.vy += (star.oy - star.y) * springPower * height;
        star.x += star.vx / width;
        star.y += star.vy / height;
        star.vx *= 0.93;
        star.vy *= 0.93;
        totalDisplacement += Math.sqrt(Math.pow(star.x - star.ox, 2) + Math.pow(star.y - star.oy, 2));
        const sx = star.x * width;
        const sy = star.y * height;
        const twinkle = Math.sin(Date.now() * star.twinkleSpeed + star.phase * 10);
        const sSize = star.size * star.z * 6 * (0.85 + twinkle * 0.15);
        const currentTex = star.colorType === 'pink' ? pinkTextureRef.current : textureRef.current;
        if (currentTex && currentTex.complete) {
          ctx.globalAlpha = star.z * (0.7 + twinkle * 0.3);
          ctx.drawImage(currentTex, sx - sSize / 2, sy - sSize / 2, sSize, sSize);
        }
      }

      if (audioCtxRef.current && masterFilterRef.current && eqFiltersRef.current.low) {
        const curTime = audioCtxRef.current.currentTime;
        
        audioElementsRef.current.left.playbackRate = leftRate;
        audioElementsRef.current.right.playbackRate = rightRate;

        if (lastPreset.current !== activePreset) {
          eqFiltersRef.current.low.gain.setTargetAtTime(0, curTime, 0.1);
          eqFiltersRef.current.mid.gain.setTargetAtTime(0, curTime, 0.1);
          eqFiltersRef.current.high.gain.setTargetAtTime(0, curTime, 0.1);
          masterFilterRef.current.Q.setTargetAtTime(1, curTime, 0.1);
          lastPreset.current = activePreset;
        }

        let sumXPink = 0, countPink = 0;
        let sumXWhite = 0, countWhite = 0;
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          if (s.colorType === 'pink') { sumXPink += s.x; countPink++; }
          else { sumXWhite += s.x; countWhite++; }
        }
        const avgXPink = sumXPink / (countPink || 1);
        const avgXWhite = sumXWhite / (countWhite || 1);

        if (activePreset === 1) {
          let wMid = 0, wHigh = 0, wLow = 0, wMuffled = 0;
          if (handData) {
            const hX = (1 - handData.x);
            const hY = handData.y;
            wMid = (1 - hX) * (1 - hY);
            wHigh = hX * (1 - hY);
            wLow = (1 - hX) * hY;
            wMuffled = hX * hY;
          }
          const eq = eqFiltersRef.current;
          eq.low.gain.setTargetAtTime(wLow * 25, curTime, 0.2);
          eq.mid.gain.setTargetAtTime(wMid * 25, curTime, 0.2);
          eq.high.gain.setTargetAtTime(wHigh * 25, curTime, 0.2);
          const targetLP = handData ? 20000 * Math.pow(0.02, wMuffled) : 800;
          masterFilterRef.current.frequency.setTargetAtTime(targetLP, curTime, 0.4);
        } else if (activePreset === 2) {
          if (handData) {
            const hX = (1 - handData.x);
            const hY = handData.y;
            const handSpeedMod = 0.8 + hX * 0.4;
            audioElementsRef.current.left.playbackRate = leftRate * handSpeedMod;
            audioElementsRef.current.right.playbackRate = rightRate * handSpeedMod;
            
            const targetLP = 20000 * Math.pow(0.02, hY);
            const targetQ = 1 + hY * 15;
            masterFilterRef.current.frequency.setTargetAtTime(targetLP, curTime, 0.1);
            masterFilterRef.current.Q.setTargetAtTime(targetQ, curTime, 0.1);
          } else {
            masterFilterRef.current.frequency.setTargetAtTime(800, curTime, 0.4);
            masterFilterRef.current.Q.setTargetAtTime(1, curTime, 0.4);
          }
        }

        if (gainsRef.current.left) {
          const gainPink = Math.pow(1 - avgXPink, 2.5); 
          const gainWhite = Math.pow(avgXWhite, 2.5);
          const avgDisplacement = totalDisplacement / stars.length;
          const chaosBoost = Math.min(avgDisplacement * 12, 0.5);
          gainsRef.current.left.gain.setTargetAtTime(Math.min(1.0, gainPink + chaosBoost), curTime, 0.15);
          gainsRef.current.right.gain.setTargetAtTime(Math.min(1.0, gainWhite + chaosBoost), curTime, 0.15);
          const panPink = Math.max(-1, Math.min(1, (avgXPink - 0.25) * 5));
          const panWhite = Math.max(-1, Math.min(1, (avgXWhite - 0.75) * 5));
          pannersRef.current.left.pan.setTargetAtTime(panPink, curTime, 0.15);
          pannersRef.current.right.pan.setTargetAtTime(panWhite, curTime, 0.15);
        }
      }

      ctx.globalAlpha = 1.0;
      if (handData) {
        const hX = (1 - handData.x) * width;
        const hY = handData.y * height;
        const hScaling = (handData.scale || 0.5) * 450;
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
  }, [handData, activePreset, leftRate, rightRate]);

  return (
    <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', display: 'block' }} />
  );
}
