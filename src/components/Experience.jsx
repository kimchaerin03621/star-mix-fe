import React, { useRef, useEffect } from 'react';

export function Starfield2D({ 
  handData, isAudioActive, onMusicReady, 
  activePreset, activeSong, songTrigger, 
  leftRate, rightRate,
  leftVolume = 1.0, rightVolume = 1.0,
  customTexture, starColors,
  onCanvasReady,
  onMixingProgress,
  isWarping,
  warpProgress = 0,
  audioCtx,
  audioElements,
  isWhiteOnly = false,
  isDimmed = false,
  onAnalyserReady
}) {
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const pinkTextureRef = useRef(null);
  const starsRef = useRef([]);
  const lastHandsPos = useRef([]); 
  const lastPreset = useRef(activePreset);
  const lastSentEnergyRef = useRef(0);
  const prevWarpingRef = useRef(false);
  const currentEnergyRef = useRef(0);
  const lastMousePosRef = useRef(null);
  const onMixingProgressRef = useRef(onMixingProgress);
  useEffect(() => {
    onMixingProgressRef.current = onMixingProgress;
  }, [onMixingProgress]);

  const isWarpingRef = useRef(isWarping);
  const warpProgressRef = useRef(warpProgress);

  useEffect(() => {
    isWarpingRef.current = isWarping;
  }, [isWarping]);

  useEffect(() => {
    warpProgressRef.current = warpProgress;
  }, [warpProgress]);

  // Reset stars when warping finishes
  useEffect(() => {
    if (prevWarpingRef.current && !isWarping) {
      starsRef.current.forEach(star => {
        star.x = star.ox;
        star.y = star.oy;
        star.vx = 0;
        star.vy = 0;
      });
      currentEnergyRef.current = 0;
      lastSentEnergyRef.current = 0;
    }
    prevWarpingRef.current = isWarping;
  }, [isWarping]);

  const handDataRef = useRef(handData);
  useEffect(() => {
    handDataRef.current = handData;
  }, [handData]);
  
  // Audio Refs
  const audioCtxRef = useRef(null);
  const audioElementsRef = useRef({ left: null, right: null });
  const pannersRef = useRef({ left: null, right: null });
  const gainsRef = useRef({ left: null, right: null });
  const matrixGainsRef = useRef({ vocalToLeft: null, vocalToRight: null, drumToRight: null, drumToLeft: null });
  const eqFiltersRef = useRef({ low: null, mid: null, high: null });
  const masterFilterRef = useRef(null);
  const isConnectedRef = useRef(false);
  const analyserRef = useRef(null);

  // Helper: Hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  };

  // 1. Initialize Stars
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
        vx: 0, vy: 0,
        colorType: initialX < 0.5 ? 'pink' : 'white',
        mass: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.001 + Math.random() * 0.004
      });
    }
    starsRef.current = newStars;
  }, []);

  useEffect(() => {
    if (canvasRef.current && onCanvasReady) {
      onCanvasReady(canvasRef.current);
    }
  }, [onCanvasReady]);

  // 2. Texture Generation (Handles both Default and Custom)
  useEffect(() => {
    const img = new Image();
    img.src = customTexture || '/star.png';
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const processTexture = (colorHex) => {
        const color = hexToRgb(colorHex);
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width; offCanvas.height = img.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(img, 0, 0);
        const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          // If custom texture, we treat darker as more opaque (black on white)
          // If default texture, we treat brighter as more opaque
          let alpha;
          if (customTexture) {
             const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
             alpha = 255 - brightness; // Black ink becomes opaque
          } else {
             alpha = (data[i] + data[i+1] + data[i+2]) / 3;
          }

          data[i] = color.r;
          data[i+1] = color.g;
          data[i+2] = color.b;
          data[i+3] = alpha;
        }
        offCtx.putImageData(imageData, 0, 0);
        const newImg = new Image();
        newImg.src = offCanvas.toDataURL();
        return newImg;
      };

      pinkTextureRef.current = processTexture(starColors?.left || '#ff5c9d');
      textureRef.current = processTexture(starColors?.right || '#ffffff');
    };
  }, [customTexture, starColors]);

  const onMusicReadyRef = useRef(onMusicReady);
  useEffect(() => {
    onMusicReadyRef.current = onMusicReady;
  }, [onMusicReady]);

  // 3. Initialize Audio (Connect Web Audio nodes without hijacking play/pause state)
  useEffect(() => {
    if (!isAudioActive || !audioCtx || !audioElements) return;

    const initAudio = async () => {
      const ctx = audioCtx;

      // Only build the Web Audio node connections if we haven't connected this context yet!
      if (audioCtxRef.current !== ctx) {
        audioCtxRef.current = ctx;

        const masterFilter = ctx.createBiquadFilter();
        masterFilter.type = 'lowpass';
        masterFilter.frequency.value = 20000;
        masterFilterRef.current = masterFilter;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        masterFilter.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
        if (onAnalyserReady) onAnalyserReady(analyser);

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

        // 2x2 Stereo Matrix Routing Nodes
        const vocalToLeftGain = ctx.createGain();   // Vocal -> L Speaker
        const vocalToRightGain = ctx.createGain();  // Vocal -> R Speaker
        const drumToRightGain = ctx.createGain();   // Drum -> R Speaker
        const drumToLeftGain = ctx.createGain();    // Drum -> L Speaker

        vocalToLeftGain.gain.value = 1.0;
        vocalToRightGain.gain.value = 0.0;
        drumToRightGain.gain.value = 1.0;
        drumToLeftGain.gain.value = 0.0;

        const merger = ctx.createChannelMerger(2); // Channel 0: Left, Channel 1: Right

        // Route Vocal (Pink) -> L (ch 0) & R (ch 1)
        vocalToLeftGain.connect(merger, 0, 0);
        vocalToRightGain.connect(merger, 0, 1);

        // Route Drum (White) -> R (ch 1) & L (ch 0)
        drumToRightGain.connect(merger, 0, 1);
        drumToLeftGain.connect(merger, 0, 0);

        merger.connect(lowShelf);

        matrixGainsRef.current = {
          vocalToLeft: vocalToLeftGain,
          vocalToRight: vocalToRightGain,
          drumToRight: drumToRightGain,
          drumToLeft: drumToLeftGain,
        };

        const leftAudio = audioElements.left;   // Vocal
        const rightAudio = audioElements.right; // Drum
        
        if (leftAudio && !leftAudio._sourceConnected) {
          leftAudio._sourceConnected = true;
          const leftSource = ctx.createMediaElementSource(leftAudio);
          leftSource.connect(vocalToLeftGain);
          leftSource.connect(vocalToRightGain);
        }
        if (rightAudio && !rightAudio._sourceConnected) {
          rightAudio._sourceConnected = true;
          const rightSource = ctx.createMediaElementSource(rightAudio);
          rightSource.connect(drumToRightGain);
          rightSource.connect(drumToLeftGain);
        }

        audioElementsRef.current = { left: leftAudio, right: rightAudio };
      }

      if (onMusicReadyRef.current) onMusicReadyRef.current();
    };

    initAudio();
  }, [isAudioActive, activeSong, songTrigger, audioCtx, audioElements]);

  // 4. Render Loop
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

    // Mouse & Touch Interaction Setup
    const mousePos = { x: -1000, y: -1000, lastX: -1000, lastY: -1000, active: false, isDown: false };
    
    const onMouseMove = (e) => {
      mousePos.active = true;
      mousePos.lastX = mousePos.x;
      mousePos.lastY = mousePos.y;
      mousePos.x = e.clientX / width;
      mousePos.y = e.clientY / height;
    };
    const onMouseEnter = () => { mousePos.active = true; };
    const onMouseLeave = () => { mousePos.active = false; };
    const onMouseDown = () => { mousePos.isDown = true; };
    const onMouseUp = () => { mousePos.isDown = false; };
    const onTouchMove = (e) => {
      if (e.touches.length > 0) {
        mousePos.active = true;
        const touch = e.touches[0];
        mousePos.lastX = mousePos.x;
        mousePos.lastY = mousePos.y;
        mousePos.x = touch.clientX / width;
        mousePos.y = touch.clientY / height;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseenter', onMouseEnter);
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchstart', onMouseEnter);
    window.addEventListener('touchend', onMouseLeave);

    const render = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Prepare hands with stable mapping and separate mouse handling to avoid index-based velocity mismatches
      const hands = [];

      // 1. Process webcam hands
      const webcamHands = Array.isArray(handDataRef.current) ? handDataRef.current : [];
      webcamHands.forEach((h, i) => {
        const hX = (1 - h.x) * width;
        const hY = h.y * height;
        if (!lastHandsPos.current[i]) {
          lastHandsPos.current[i] = { x: hX, y: hY };
        }
        const vx = (hX - lastHandsPos.current[i].x) * 0.08;
        const vy = (hY - lastHandsPos.current[i].y) * 0.08;
        
        hands.push({
          x: h.x,
          y: h.y,
          screenX: 1 - h.x,
          screenY: h.y,
          scale: h.scale || 0.5,
          isFist: h.isFist,
          isMouse: false,
          hX,
          hY,
          vx,
          vy
        });
        
        lastHandsPos.current[i] = { x: hX, y: hY };
      });

      // 2. Process mouse hand (only if no webcam hands are currently detected)
      if (mousePos.active && webcamHands.length === 0) {
        const mX = mousePos.x * width;
        const mY = mousePos.y * height;
        if (!lastMousePosRef.current) {
          lastMousePosRef.current = { x: mX, y: mY };
        }
        const vx = (mX - lastMousePosRef.current.x) * 0.08;
        const vy = (mY - lastMousePosRef.current.y) * 0.08;

        hands.push({
          x: mousePos.x,
          y: mousePos.y,
          screenX: mousePos.x,
          screenY: mousePos.y,
          scale: mousePos.isDown ? 0.75 : 0.45,
          isFist: false,
          isMouse: true,
          hX: mX,
          hY: mY,
          vx,
          vy
        });

        lastMousePosRef.current = { x: mX, y: mY };
      }

      const stars = starsRef.current;
      let totalDisplacement = 0;
      let activePushes = 0;

      stars.forEach(star => {
        let isPushed = false;
        hands.forEach((h) => {
          const dx = (star.x * width) - h.hX;
          const dy = (star.y * height) - h.hY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const hScaling = h.scale * 450;
          if (dist < hScaling) {
            const forceFactor = Math.pow(1 - dist / hScaling, 1.5);
            const repelX = (dx / dist) * 0.08;
            const repelY = (dy / dist) * 0.08;
            const swirlX = (-dy / dist) * 0.12;
            const swirlY = (dx / dist) * 0.12;
            const depthFactor = star.z;
            star.vx += (repelX + swirlX + h.vx) * forceFactor * (1 / star.mass) * depthFactor;
            star.vy += (repelY + swirlY + h.vy) * forceFactor * (1 / star.mass) * depthFactor;
            isPushed = true;
          }
        });
        if (isPushed) {
          activePushes++;
        }

        if (isWarpingRef.current) {
          // Warp Speed outward acceleration from center (0.5, 0.5)
          const dx = star.x - 0.5;
          const dy = star.y - 0.5;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const warpAccel = 0.001 * (1 + warpProgressRef.current * 4) * star.z;
          star.vx += (dx / dist) * warpAccel * width;
          star.vy += (dy / dist) * warpAccel * height;
        } else {
          star.vx += Math.sin(Date.now() * 0.005 + star.phase) * 0.003;
          star.vy += Math.cos(Date.now() * 0.005 + star.phase) * 0.003;
          const springPower = 0.0004;
          star.vx += (star.ox - star.x) * springPower * width;
          star.vy += (star.oy - star.y) * springPower * height;
        }

        star.x += star.vx / width;
        star.y += star.vy / height;
        // Smart Damping: Full velocity when hand touches (isPushed), instant decay (0.75) when hand leaves to eliminate trailing afterimage
        const damping = isWarpingRef.current ? 0.95 : (isPushed ? 0.90 : 0.75);
        star.vx *= damping;
        star.vy *= damping;
        totalDisplacement += Math.sqrt(Math.pow(star.x - star.ox, 2) + Math.pow(star.y - star.oy, 2));

        const sx = star.x * width;
        const sy = star.y * height;
        const twinkle = Math.sin(Date.now() * star.twinkleSpeed + star.phase * 10);
        const sSize = star.size * star.z * 6 * (0.85 + twinkle * 0.15);

        if (isWarpingRef.current) {
          // Hyperdrive streak lines drawing
          ctx.strokeStyle = (isWhiteOnly || star.colorType === 'white') ? (starColors?.right || '#ffffff') : (starColors?.left || '#ff007f');
          ctx.lineWidth = Math.max(1, star.size * star.z * 1.5);
          ctx.lineCap = 'round';
          ctx.globalAlpha = star.z * 0.8;
          ctx.beginPath();
          const prevSx = (star.x - star.vx * 1.5 / width) * width;
          const prevSy = (star.y - star.vy * 1.5 / height) * height;
          ctx.moveTo(prevSx, prevSy);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        } else {
          const currentTex = (isWhiteOnly || star.colorType === 'white') ? textureRef.current : (pinkTextureRef.current || textureRef.current);
          if (currentTex && currentTex.complete) {
            ctx.globalAlpha = star.z * (0.7 + twinkle * 0.3);
            ctx.drawImage(currentTex, sx - sSize / 2, sy - sSize / 2, sSize, sSize);
          }
        }
      });

      // 2. Real-time Crossover Ratio & Equal Power Logarithmic Crossfade Calculation (60 FPS)
      if (matrixGainsRef.current && starsRef.current) {
        let pinkCrossed = 0;
        let whiteCrossed = 0;
        let pinkTotal = 0;
        let whiteTotal = 0;

        starsRef.current.forEach(star => {
          if (star.colorType === 'pink') {
            pinkTotal++;
            if (star.x > 0.52) pinkCrossed++; // Pink star crossed center line to Right zone
          } else {
            whiteTotal++;
            if (star.x < 0.48) whiteCrossed++; // White star crossed center line to Left zone
          }
        });

        // Ratio of stars crossed over (0.0 to 1.0)
        // 20% displacement = 100% full crossfade
        const pinkRatio = Math.min(1.0, (pinkCrossed / ((pinkTotal * 0.20) || 1)));
        const whiteRatio = Math.min(1.0, (whiteCrossed / ((whiteTotal * 0.20) || 1)));

        // Equal Power Logarithmic Crossfade Curve (cos / sin angle)
        // Guarantees constant perceived volume without clipping or volume dips
        const anglePink = pinkRatio * (Math.PI / 4);   // 0 to 45 deg
        const angleWhite = whiteRatio * (Math.PI / 4); // 0 to 45 deg

        const vToL = Math.cos(anglePink) * leftVolume;
        const vToR = Math.sin(anglePink) * leftVolume;

        const dToR = Math.cos(angleWhite) * rightVolume;
        const dToL = Math.sin(angleWhite) * rightVolume;

        const mg = matrixGainsRef.current;
        if (mg.vocalToLeft) mg.vocalToLeft.gain.value = vToL;
        if (mg.vocalToRight) mg.vocalToRight.gain.value = vToR;
        if (mg.drumToRight) mg.drumToRight.gain.value = dToR;
        if (mg.drumToLeft) mg.drumToLeft.gain.value = dToL;
      }

      if (onMixingProgressRef.current && !isWarpingRef.current) {
        if (activePushes > 0) {
          // Max increment of 0.4% per frame (approx 4.2 seconds minimum to fill)
          const increment = Math.min(0.4, activePushes * 0.0075);
          currentEnergyRef.current = Math.min(100, currentEnergyRef.current + increment);
        }
        
        const integerEnergy = Math.floor(currentEnergyRef.current);
        if (integerEnergy !== lastSentEnergyRef.current) {
          lastSentEnergyRef.current = integerEnergy;
          onMixingProgressRef.current(integerEnergy);
        }
      }

      const avgDisplacement = totalDisplacement / stars.length;

      if (audioCtxRef.current && masterFilterRef.current && eqFiltersRef.current.low && audioElementsRef.current.left && audioElementsRef.current.right) {
        const curTime = audioCtxRef.current.currentTime;
        const safeVal = (val, fallback = 0) => (Number.isFinite(val) ? val : fallback);
        audioElementsRef.current.left.playbackRate = safeVal(leftRate, 1.0);
        audioElementsRef.current.right.playbackRate = safeVal(rightRate, 1.0);

        if (lastPreset.current !== activePreset) {
          eqFiltersRef.current.low.gain.setTargetAtTime(0, curTime, 0.1);
          eqFiltersRef.current.mid.gain.setTargetAtTime(0, curTime, 0.1);
          eqFiltersRef.current.high.gain.setTargetAtTime(0, curTime, 0.1);
          masterFilterRef.current.Q.setTargetAtTime(1, curTime, 0.1);
          lastPreset.current = activePreset;
        }

        // 4-Quadrant EQ & NDS Presets are exclusively triggered by real webcam hand tracking (ignoring mouse movement)
        const primaryHand = hands.find(h => !h.isMouse);

        if (primaryHand) {
          const normX = primaryHand.screenX;
          const normY = primaryHand.screenY;
          if (activePreset === 1) {
            const wMid = (1 - normX) * (1 - normY);      // Upper-Left: Mid Boost
            const wHigh = normX * (1 - normY);          // Upper-Right: High Boost
            const wLow = (1 - normX) * normY;           // Lower-Left: Low Sub-Bass Boost
            const wMuffled = normX * normY;             // Lower-Right: Deep Muffled Lowpass Filter!

            // Bold EQ Transformation (+26 dB max boost, -20 dB cut for non-selected bands)
            const lowGain = wLow * 26.0 - (wMid + wHigh) * 20.0;
            const midGain = wMid * 26.0 - (wLow + wHigh) * 20.0;
            const highGain = wHigh * 26.0 - (wLow + wMid) * 20.0;

            // Master Filter Frequency: Plunges down to 350 Hz in Lower-Right for deep underwater muffled sound!
            const targetFreq = Math.max(350, 20000 * (1 - wMuffled * 0.98));

            const eq = eqFiltersRef.current;
            eq.low.gain.setTargetAtTime(safeVal(lowGain, 0), curTime, 0.05);
            eq.mid.gain.setTargetAtTime(safeVal(midGain, 0), curTime, 0.05);
            eq.high.gain.setTargetAtTime(safeVal(highGain, 0), curTime, 0.05);
            masterFilterRef.current.frequency.setTargetAtTime(safeVal(targetFreq, 20000), curTime, 0.05);
          } else if (activePreset === 2) {
            const handSpeedMod = 0.8 + safeVal(normX, 0) * 0.4;
            audioElementsRef.current.left.playbackRate = safeVal(leftRate * handSpeedMod, 1.0);
            audioElementsRef.current.right.playbackRate = safeVal(rightRate * handSpeedMod, 1.0);
            masterFilterRef.current.frequency.setTargetAtTime(20000, curTime, 0.1);
          }
        } else {
          eqFiltersRef.current.low.gain.setTargetAtTime(0, curTime, 0.1);
          eqFiltersRef.current.mid.gain.setTargetAtTime(0, curTime, 0.1);
          eqFiltersRef.current.high.gain.setTargetAtTime(0, curTime, 0.1);
          masterFilterRef.current.frequency.setTargetAtTime(20000, curTime, 0.1);
        }

        if (gainsRef.current.left && gainsRef.current.right) {
          gainsRef.current.left.gain.setTargetAtTime(safeVal(leftVolume, 1.0), curTime, 0.05);
          gainsRef.current.right.gain.setTargetAtTime(safeVal(rightVolume, 1.0), curTime, 0.05);
        }
      }

      // Visualize ALL hands with adjusted aura intensity
      hands.forEach(h => {
        ctx.globalCompositeOperation = 'lighter';
        const auraRadius = h.scale * 450;
        const gradient = ctx.createRadialGradient(h.hX, h.hY, 0, h.hX, h.hY, auraRadius);
        gradient.addColorStop(0, h.isMouse ? 'rgba(0, 255, 204, 0.25)' : 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(h.hX, h.hY, auraRadius, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      });

      // Render Audio Core Monitor Visualizer if present
      const vizCanvas = document.getElementById('audio-monitor-visualizer');
      if (vizCanvas && analyserRef.current) {
        const vizCtx = vizCanvas.getContext('2d');
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        vizCtx.fillStyle = 'rgba(10, 10, 15, 0.6)';
        vizCtx.fillRect(0, 0, vizCanvas.width, vizCanvas.height);

        const barWidth = (vizCanvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] / 4.5;
          const grad = vizCtx.createLinearGradient(0, vizCanvas.height, 0, 0);
          grad.addColorStop(0, '#ff007f');
          grad.addColorStop(1, '#00ffcc');
          vizCtx.fillStyle = grad;
          vizCtx.fillRect(x, vizCanvas.height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseenter', onMouseEnter);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchstart', onMouseEnter);
      canvas.removeEventListener('touchend', onMouseLeave);
    };
  }, [activePreset, leftRate, rightRate]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        display: 'block',
        opacity: isDimmed ? 0.35 : 1.0,
        transition: 'opacity 0.5s ease-in-out'
      }} 
    />
  );
}
