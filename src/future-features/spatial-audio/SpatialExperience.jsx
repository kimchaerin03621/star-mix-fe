import React, { useRef, useEffect } from 'react';

export function SpatialExperience({ 
  handData, isAudioActive, onMusicReady, 
  activePreset, activeSong, songTrigger, 
  leftRate, rightRate,
  customTexture, starColors,
  onCanvasReady,
  controlMode = 'hand'
}) {
  const canvasRef = useRef(null);
  const textureRef = useRef(null);
  const pinkTextureRef = useRef(null);
  
  // 3D Sound Orbs (Smooth interpolations)
  const orbsRef = useRef({
    left: { cx: -3, cy: 0, cz: -2, tx: -3, ty: 0, tz: -2, angle: 0, grabbedBy: null, isGrabbed: false },
    right: { cx: 3, cy: 0, cz: -2, tx: 3, ty: 0, tz: -2, angle: Math.PI, grabbedBy: null, isGrabbed: false }
  });

  const starsRef = useRef([]);
  const lastHandsPos = useRef([]); 
  const lastOrbsPos = useRef({
    left: { x: null, y: null },
    right: { x: null, y: null }
  });
  const lastPreset = useRef(activePreset);

  // Sync references to avoid canvas render loop teardown and layout reflow on every frame
  const handDataRef = useRef(handData);
  const activePresetRef = useRef(activePreset);
  const leftRateRef = useRef(leftRate);
  const rightRateRef = useRef(rightRate);
  const starColorsRef = useRef(starColors);
  const controlModeRef = useRef(controlMode);
  const keysPressedRef = useRef({});

  useEffect(() => { handDataRef.current = handData; }, [handData]);
  useEffect(() => { activePresetRef.current = activePreset; }, [activePreset]);
  useEffect(() => { leftRateRef.current = leftRate; }, [leftRate]);
  useEffect(() => { rightRateRef.current = rightRate; }, [rightRate]);
  useEffect(() => { starColorsRef.current = starColors; }, [starColors]);
  useEffect(() => { controlModeRef.current = controlMode; }, [controlMode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (controlModeRef.current === 'keyboard') {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) ||
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }
      }
      keysPressedRef.current[e.key] = true;
      keysPressedRef.current[e.code] = true;
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
        keysPressedRef.current[e.key.toLowerCase()] = true;
        keysPressedRef.current[e.key.toUpperCase()] = true;
      }
    };

    const handleKeyUp = (e) => {
      keysPressedRef.current[e.key] = false;
      keysPressedRef.current[e.code] = false;
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
        keysPressedRef.current[e.key.toLowerCase()] = false;
        keysPressedRef.current[e.key.toUpperCase()] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Audio Context and Nodes
  const audioCtxRef = useRef(null);
  const audioElementsRef = useRef({ left: null, right: null });
  const pannersRef = useRef({ left: null, right: null });
  const gainsRef = useRef({ left: null, right: null });
  const eqFiltersRef = useRef({ low: null, mid: null, high: null });
  const masterFilterRef = useRef(null);

  // Helper: Hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  };

  // 1. Initialize Stars (Matches webcam mode layout)
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

  // 2. Texture Generation (Custom Star Sketch)
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
          let alpha;
          if (customTexture) {
             const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
             alpha = 255 - brightness;
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

      pinkTextureRef.current = processTexture(starColors?.left || '#00ffcc');
      textureRef.current = processTexture(starColors?.right || '#ffffff');
    };
  }, [customTexture, starColors]);

  // 3. Initialize Dolby Atmos 3D HRTF Web Audio Context
  useEffect(() => {
    if (!isAudioActive) return;

    const initAudio = async () => {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // 3D Audio Listener alignment
      const listener = ctx.listener;
      const curTime = ctx.currentTime;
      if (listener.positionX) {
        listener.positionX.setValueAtTime(0, curTime);
        listener.positionY.setValueAtTime(0, curTime);
        listener.positionZ.setValueAtTime(0, curTime);
        listener.forwardX.setValueAtTime(0, curTime);
        listener.forwardY.setValueAtTime(0, curTime);
        listener.forwardZ.setValueAtTime(-1, curTime); // Facing forward (-Z)
        listener.upX.setValueAtTime(0, curTime);
        listener.upY.setValueAtTime(1, curTime);
        listener.upZ.setValueAtTime(0, curTime);
      } else {
        listener.setPosition(0, 0, 0);
        listener.setOrientation(0, 0, -1, 0, 1, 0);
      }

      const masterFilter = ctx.createBiquadFilter();
      masterFilter.type = 'lowpass';
      masterFilter.frequency.value = 20000;

      // Dynamics Compressor to boost overall volume and prevent clipping
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-16, curTime);
      compressor.knee.setValueAtTime(30, curTime);
      compressor.ratio.setValueAtTime(12, curTime);
      compressor.attack.setValueAtTime(0.003, curTime);
      compressor.release.setValueAtTime(0.25, curTime);

      masterFilter.connect(compressor);
      compressor.connect(ctx.destination);
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

      const createTrack = (url, isLeftTrack) => {
        const audio = new Audio(url);
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        audio.preservesPitch = true;
        
        const source = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 0;

        // Web Audio API 3D HRTF Panner
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 4.0; // Increased refDistance for wider full-volume range
        panner.maxDistance = 10000;
        panner.rolloffFactor = 0.7; // Smooth roll-off to prevent excessive muting at distance

        // Initial positions (Left: left, Right: right)
        panner.positionX.setValueAtTime(isLeftTrack ? -3 : 3, curTime);
        panner.positionY.setValueAtTime(0, curTime);
        panner.positionZ.setValueAtTime(-2, curTime);

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

      const left = createTrack(vocal, true);
      const right = createTrack(drum, false);

      audioElementsRef.current = { left: left.audio, right: right.audio };
      pannersRef.current = { left: left.panner, right: right.panner };
      gainsRef.current = { left: left.gain, right: right.gain };

      const startPlayback = async () => {
        try {
          if (ctx.state === 'suspended') await ctx.resume();
          await Promise.all([left.audio.play(), right.audio.play()]);
          if (onMusicReady) onMusicReady();
        } catch {
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
  }, [isAudioActive, activeSong, songTrigger]);

  // 4. Render & Physics Loop
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
      // Deep Space background for experiment theme
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const scaleFactor = Math.min(width, height) * 0.08; // Coordinate scaling in pixels

      const hands = Array.isArray(handDataRef.current) ? handDataRef.current : [];
      const orbs = orbsRef.current;

      const cameraDistance = 6.0; // Distance to camera along Z axis in meters

      // Helper to calculate current screen coordinates of an orb
      const getOrbScreenPos = (orb) => {
        const depthProj = cameraDistance / Math.max(0.1, cameraDistance + orb.cz);
        const sx = centerX + orb.cx * scaleFactor * depthProj;
        const sy = centerY - orb.cy * scaleFactor * depthProj;
        return { sx, sy, depthProj };
      };

      // 4.1 Grab Detection & Coordinate Mapping (Direct Tether interaction)
      if (controlModeRef.current === 'keyboard') {
        // Clear all hand grab states in keyboard mode
        Object.keys(orbs).forEach(key => {
          orbs[key].isGrabbed = false;
          orbs[key].grabbedBy = null;
        });

        const keys = keysPressedRef.current;
        const speed = 0.22; // Increased from 0.09 for much faster and highly responsive movements

        // Layout/IME/CapsLock immune key checks
        const isLeftW = keys['w'] || keys['W'] || keys['KeyW'] || keys['ㅈ'];
        const isLeftA = keys['a'] || keys['A'] || keys['KeyA'] || keys['ㅁ'];
        const isLeftS = keys['s'] || keys['S'] || keys['KeyS'] || keys['ㄴ'];
        const isLeftD = keys['d'] || keys['D'] || keys['KeyD'] || keys['ㅇ'];
        const isShift = keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight'];

        // Left Orb Control (WASD)
        const leftOrb = orbs.left;
        let leftDX = 0;
        let leftDY = 0;
        let leftDZ = 0;

        if (isLeftA) leftDX = -speed;
        if (isLeftD) leftDX = speed;
        
        if (isShift) {
          // Shift + W/S control Z-axis (Depth)
          if (isLeftW) leftDZ = speed; // closer
          if (isLeftS) leftDZ = -speed; // further
        } else {
          // W/S control Y-axis (Up/Down)
          if (isLeftW) leftDY = speed;
          if (isLeftS) leftDY = -speed;
        }

        leftOrb.tx = Math.max(-5, Math.min(5, leftOrb.tx + leftDX));
        leftOrb.ty = Math.max(-4, Math.min(4, leftOrb.ty + leftDY));
        leftOrb.tz = Math.max(-4.5, Math.min(4.5, leftOrb.tz + leftDZ)); // Increased limit to +4.5 to allow going behind the head

        // Right Orb Control (Arrow Keys)
        const rightOrb = orbs.right;
        let rightDX = 0;
        let rightDY = 0;
        let rightDZ = 0;

        const isArrowLeft = keys['ArrowLeft'];
        const isArrowRight = keys['ArrowRight'];
        const isArrowUp = keys['ArrowUp'];
        const isArrowDown = keys['ArrowDown'];

        if (isArrowLeft) rightDX = -speed;
        if (isArrowRight) rightDX = speed;

        if (isShift) {
          // Shift + ArrowUp/ArrowDown control Z-axis (Depth)
          if (isArrowUp) rightDZ = speed; // closer
          if (isArrowDown) rightDZ = -speed; // further
        } else {
          // ArrowUp/ArrowDown control Y-axis (Up/Down)
          if (isArrowUp) rightDY = speed;
          if (isArrowDown) rightDY = -speed;
        }

        rightOrb.tx = Math.max(-5, Math.min(5, rightOrb.tx + rightDX));
        rightOrb.ty = Math.max(-4, Math.min(4, rightOrb.ty + rightDY));
        rightOrb.tz = Math.max(-4.5, Math.min(4.5, rightOrb.tz + rightDZ)); // Increased limit to +4.5 to allow going behind the head

      } else {
        // HAND CONTROL MODE (Grab Detection)
        const GRAB_START_THRESHOLD = 0.85;
        const GRAB_RELEASE_THRESHOLD = 0.80; // Raised to ensure immediate release when hand is slightly opened

        Object.keys(orbs).forEach(key => {
          const orb = orbs[key];
          const { sx, sy } = getOrbScreenPos(orb);

          // Find the hand currently grabbing this orb, if any
          let matchingHand = null;
          if (orb.grabbedBy) {
            // 1. Try to find by exact handedness
            matchingHand = hands.find(h => h.handedness === orb.grabbedBy);
            
            // 2. If not found by handedness (due to MediaPipe handedness flickering),
            // check if there is a hand extremely close to the orb screen position (within 150px)
            if (!matchingHand) {
              matchingHand = hands.find(h => {
                const hX = (1 - h.x) * width;
                const hY = h.y * height;
                const dist = Math.sqrt(Math.pow(hX - sx, 2) + Math.pow(hY - sy, 2));
                return dist < 150;
              });
            }

            // 3. Fallback to hands[0] ONLY if it's the only hand currently detected
            if (!matchingHand && hands.length === 1) {
              matchingHand = hands[0];
            }
            
            // Verify if the hand is still detected and remains clenched above release threshold
            if (matchingHand && matchingHand.curlAmount > GRAB_RELEASE_THRESHOLD) {
              orb.isGrabbed = true;
              orb.grabbedBy = matchingHand.handedness; // lock/update handedness
            } else {
              orb.grabbedBy = null;
              orb.isGrabbed = false;
              matchingHand = null;
            }
          }

          // If not grabbed, find a close hand clenching to grab it
          if (!orb.isGrabbed) {
            const otherKey = key === 'left' ? 'right' : 'left';
            const otherOrb = orbs[otherKey];

            const potentialHand = hands.find(h => {
              const hX = (1 - h.x) * width;
              const hY = h.y * height;
              const dist = Math.sqrt(Math.pow(hX - sx, 2) + Math.pow(hY - sy, 2));
              const isAlreadyGrabbingOther = otherOrb.isGrabbed && otherOrb.grabbedBy === h.handedness;

              return dist < 120 && h.isFist && !isAlreadyGrabbingOther;
            });

            if (potentialHand) {
              orb.grabbedBy = potentialHand.handedness;
              orb.isGrabbed = true;
              matchingHand = potentialHand;
            }
          }

          // Update target positions based on grab state
          if (orb.isGrabbed && matchingHand) {
            // Grabbed: follow the hand coordinates directly using screen matching projection!
            const hX = (1 - matchingHand.x) * width;
            const hY = matchingHand.y * height;
            
            // Map hand scale (0.1 to 0.8) to 3D depth Z (-1.0 to -4.5 in front of listener)
            const handScale = Math.max(0.1, Math.min(0.8, matchingHand.scale || 0.45));
            orb.tz = -1.0 - (handScale - 0.1) * 5.0; // handScale 0.1..0.8 -> -1.0..-4.5m
            
            const depthProj = cameraDistance / Math.max(0.1, cameraDistance + orb.tz);
            
            // Solve: hX = centerX + tx * scaleFactor * depthProj
            orb.tx = (hX - centerX) / Math.max(0.1, scaleFactor * depthProj);
            // Solve: hY = centerY - ty * scaleFactor * depthProj
            orb.ty = -(hY - centerY) / Math.max(0.1, scaleFactor * depthProj);
          }
        });
      }

      // Smoothly interpolate current position towards targets (Dynamic responsive tracking)
      Object.keys(orbs).forEach(key => {
        const orb = orbs[key];
        const lerpSpeed = orb.isGrabbed ? 0.35 : 0.08; // 35% catch up per frame when grabbed for ultra-responsive drag, 8% for gentle bobbing
        orb.cx += (orb.tx - orb.cx) * lerpSpeed;
        orb.cy += (orb.ty - orb.cy) * lerpSpeed;
        orb.cz += (orb.tz - orb.cz) * lerpSpeed;
      });

      // 4.2 Web Audio 3D HRTF Coordinates Update
      if (audioCtxRef.current && masterFilterRef.current && pannersRef.current.left) {
        const webAudioTime = audioCtxRef.current.currentTime;
        audioElementsRef.current.left.playbackRate = leftRateRef.current;
        audioElementsRef.current.right.playbackRate = rightRateRef.current;

        // Reset filter gains on preset toggle
        if (lastPreset.current !== activePresetRef.current) {
          eqFiltersRef.current.low.gain.setTargetAtTime(0, webAudioTime, 0.1);
          eqFiltersRef.current.mid.gain.setTargetAtTime(0, webAudioTime, 0.1);
          eqFiltersRef.current.high.gain.setTargetAtTime(0, webAudioTime, 0.1);
          masterFilterRef.current.Q.setTargetAtTime(1, webAudioTime, 0.1);
          lastPreset.current = activePresetRef.current;
        }

        // Connect 3D coordinates smoothly to Audio Panners
        pannersRef.current.left.positionX.setTargetAtTime(orbs.left.cx * 1.2, webAudioTime, 0.1);
        pannersRef.current.left.positionY.setTargetAtTime(orbs.left.cy * 1.2, webAudioTime, 0.1);
        pannersRef.current.left.positionZ.setTargetAtTime(orbs.left.cz * 1.2, webAudioTime, 0.1);

        pannersRef.current.right.positionX.setTargetAtTime(orbs.right.cx * 1.2, webAudioTime, 0.1);
        pannersRef.current.right.positionY.setTargetAtTime(orbs.right.cy * 1.2, webAudioTime, 0.1);
        pannersRef.current.right.positionZ.setTargetAtTime(orbs.right.cz * 1.2, webAudioTime, 0.1);

        // Apply Experimental Modulations (Presets mapping)
        const primaryHand = hands[0];
        if (primaryHand) {
          const hX = (1 - primaryHand.x);
          const hY = primaryHand.y;
          if (activePresetRef.current === 1) {
            const wMid = (1 - hX) * (1 - hY);
            const wHigh = hX * (1 - hY);
            const wLow = (1 - hX) * hY;
            const wMuffled = hX * hY;
            const eq = eqFiltersRef.current;
            eq.low.gain.setTargetAtTime(wLow * 25, webAudioTime, 0.2);
            eq.mid.gain.setTargetAtTime(wMid * 25, webAudioTime, 0.2);
            eq.high.gain.setTargetAtTime(wHigh * 25, webAudioTime, 0.2);
            const targetLP = 20000 * Math.pow(0.02, wMuffled);
            masterFilterRef.current.frequency.setTargetAtTime(targetLP, webAudioTime, 0.4);
          } else if (activePresetRef.current === 2) {
            const handSpeedMod = 0.8 + hX * 0.4;
            audioElementsRef.current.left.playbackRate = leftRateRef.current * handSpeedMod;
            audioElementsRef.current.right.playbackRate = rightRateRef.current * handSpeedMod;
            const targetLP = 20000 * Math.pow(0.02, hY);
            const targetQ = 1 + hY * 15;
            masterFilterRef.current.frequency.setTargetAtTime(targetLP, webAudioTime, 0.1);
            masterFilterRef.current.Q.setTargetAtTime(targetQ, webAudioTime, 0.1);
          }
        }

        // In Spatial Mode, the audio plays continuously during grab & drag interaction,
        // letting the user hear dynamic 360-degree panning without muting.
        if (gainsRef.current.left) {
          gainsRef.current.left.gain.setTargetAtTime(1.5, webAudioTime, 0.1);
          gainsRef.current.right.gain.setTargetAtTime(1.5, webAudioTime, 0.1);
        }
      }

      // 4.3 3D Rendering Calculations (Screen depth projections)
      const renderQueue = [];

      // A. Add central headphones listener head node to render queue
      renderQueue.push({
        type: 'listener',
        z3D: 0,
        render: () => {
          // Draw Neon Headphones Listener
          ctx.save();
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#00ff7f';
          ctx.fillStyle = 'rgba(0, 255, 127, 0.15)';
          ctx.strokeStyle = '#00ff7f';
          ctx.lineWidth = 3;

          // Head circle
          ctx.beginPath();
          ctx.arc(centerX, centerY, 32, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Headphone headband arch
          ctx.beginPath();
          ctx.arc(centerX, centerY, 42, Math.PI, 0, false);
          ctx.stroke();

          // Earcups
          ctx.fillStyle = '#00ff7f';
          ctx.beginPath();
          ctx.roundRect(centerX - 47, centerY - 12, 10, 24, 5);
          ctx.roundRect(centerX + 37, centerY - 12, 10, 24, 5);
          ctx.fill();
          ctx.restore();
        }
      });

      // B. Add left and right glowing sound orbs to render queue
      const getOrbGlowColor = (type) => type === 'left' ? (starColorsRef.current?.left || '#00ffcc') : (starColorsRef.current?.right || '#ffffff');
      
      Object.keys(orbs).forEach(key => {
        const orb = orbs[key];
        const depthProj = cameraDistance / Math.max(0.1, cameraDistance + orb.cz);
        const sx = centerX + orb.cx * scaleFactor * depthProj;
        const sy = centerY - orb.cy * scaleFactor * depthProj;
        const orbSize = Math.max(1, 38 * depthProj);
        const glowColor = getOrbGlowColor(key);

        renderQueue.push({
          type: 'orb',
          z3D: orb.cz,
          render: () => {
            ctx.save();
            const isBehind = orb.cz > 0;
            if (isBehind) {
              ctx.globalAlpha = 0.35; // semi-transparent to denote it is behind the auditory plane
              ctx.shadowBlur = 10 * depthProj;
            } else {
              ctx.shadowBlur = 30 * depthProj;
            }
            ctx.shadowColor = glowColor;
            
            // 3D shaded sphere using radial gradient
            const gradient = ctx.createRadialGradient(sx - orbSize * 0.25, sy - orbSize * 0.25, 0, sx, sy, orbSize);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.3, glowColor);
            gradient.addColorStop(1, 'rgba(0,0,0,0.85)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(sx, sy, orbSize, 0, Math.PI * 2);
            ctx.fill();

            // Highlight ring
            if (isBehind) {
              ctx.strokeStyle = `rgba(255, 255, 255, 0.2)`;
              ctx.lineWidth = 1.5;
              ctx.setLineDash([3, 3]); // dashed line for rear hemisphere
            } else {
              ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * depthProj})`;
              ctx.lineWidth = 1;
            }
            ctx.stroke();
            ctx.restore();
          }
        });
      });

      // C. Render stars exactly like in the main webcam mode (Starfield2D)
      const stars = starsRef.current;

      // A. Calculate Glowing Orb 2D Screen Velocities for Star Physics
      const orbVelocities = {};
      Object.keys(orbs).forEach(key => {
        const orb = orbs[key];
        const { sx, sy } = getOrbScreenPos(orb);
        
        const lastPos = lastOrbsPos.current[key];
        let vx = 0;
        let vy = 0;
        
        if (lastPos && lastPos.x !== null && lastPos.y !== null) {
          vx = sx - lastPos.x;
          vy = sy - lastPos.y;
        }
        
        orbVelocities[key] = { sx, sy, vx, vy };
        lastOrbsPos.current[key] = { x: sx, y: sy };
      });

      stars.forEach(star => {
        Object.keys(orbVelocities).forEach(key => {
          const { sx: oX, sy: oY, vx: oVX, vy: oVY } = orbVelocities[key];
          const orb = orbs[key];
          const depthProj = cameraDistance / Math.max(0.1, cameraDistance + orb.cz);
          
          // Influence radius of glowing big stars (scaled by depth)
          const orbScaling = 240 * depthProj;
          const dx = (star.x * width) - oX;
          const dy = (star.y * height) - oY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < orbScaling) {
            const forceFactor = Math.pow(1 - dist / orbScaling, 1.5);
            // Gentle orbital/repel forces around the big stars
            const repelX = (dx / dist) * 0.08;
            const repelY = (dy / dist) * 0.08;
            const swirlX = (-dy / dist) * 0.12;
            const swirlY = (dx / dist) * 0.12;
            
            // Drag small stars along with the big star's velocity
            const dragX = oVX * 0.08;
            const dragY = oVY * 0.08;
            
            const depthFactor = star.z;
            star.vx += (repelX + swirlX + dragX) * forceFactor * (1 / star.mass) * depthFactor;
            star.vy += (repelY + swirlY + dragY) * forceFactor * (1 / star.mass) * depthFactor;
          }
        });

        star.vx += Math.sin(Date.now() * 0.005 + star.phase) * 0.003;
        star.vy += Math.cos(Date.now() * 0.005 + star.phase) * 0.003;
        const springPower = 0.0004;
        star.vx += (star.ox - star.x) * springPower * width;
        star.vy += (star.oy - star.y) * springPower * height;
        star.x += star.vx / width;
        star.y += star.vy / height;
        
        // Smart Damping: Keep movement dynamic when touched, immediately stop trailing wake when passed
        star.vx *= 0.75;
        star.vy *= 0.75;

        const sx = star.x * width;
        const sy = star.y * height;
        const twinkle = Math.sin(Date.now() * star.twinkleSpeed + star.phase * 10);
        const sSize = star.size * star.z * 6 * (0.85 + twinkle * 0.15);
        const glowColor = getOrbGlowColor(star.colorType === 'pink' ? 'left' : 'right');

        // Map star.z to 3D depth for Z-sorting
        const z3D = -1.0 - (1.0 - star.z) * 4.0;

        renderQueue.push({
          type: 'star',
          z3D: z3D,
          render: () => {
            const currentTex = star.colorType === 'pink' ? pinkTextureRef.current : textureRef.current;
            if (currentTex && currentTex.complete) {
              ctx.save();
              ctx.globalAlpha = star.z * (0.7 + twinkle * 0.3);
              ctx.shadowBlur = 6 * star.z;
              ctx.shadowColor = glowColor;
              ctx.drawImage(currentTex, sx - sSize / 2, sy - sSize / 2, sSize, sSize);
              ctx.restore();
            }
          }
        });
      });

      hands.forEach((h, i) => {
        lastHandsPos.current[i] = { x: (1-h.x)*width, y: h.y*height };
      });

      // 4.4 Render sorting based on Depth (Z-sorting: Painters algorithm)
      renderQueue.sort((a, b) => b.z3D - a.z3D);
      renderQueue.forEach(obj => obj.render());

      // 4.5 Draw grab tethers and hover target rings (Hand mode only)
      if (controlModeRef.current !== 'keyboard') {
        hands.forEach(h => {
          const hX = (1 - h.x) * width;
          const hY = h.y * height;

          Object.keys(orbs).forEach(key => {
            const orb = orbs[key];
            const depthProj = cameraDistance / Math.max(0.1, cameraDistance + orb.cz);
            const sx = centerX + orb.cx * scaleFactor * depthProj;
            const sy = centerY - orb.cy * scaleFactor * depthProj;
            const dist = Math.sqrt(Math.pow(hX - sx, 2) + Math.pow(hY - sy, 2));
            const glowColor = getOrbGlowColor(key);

            if (orb.isGrabbed && orb.grabbedBy === h.handedness) {
              // Draw active neon grab tether beam
              ctx.save();
              ctx.shadowBlur = 15;
              ctx.shadowColor = glowColor;
              ctx.strokeStyle = glowColor;
              ctx.lineWidth = 3;
              ctx.setLineDash([4, 4]); // cool dashed tether line
              ctx.beginPath();
              ctx.moveTo(hX, hY);
              ctx.lineTo(sx, sy);
              ctx.stroke();
              
              // Draw a pulsing grabbed halo around the orb
              ctx.setLineDash([]);
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(sx, sy, Math.max(1, (38 * depthProj) + 12 + Math.sin(Date.now() * 0.01) * 4), 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            } else if (dist < 120 && !orb.isGrabbed) {
              // Hover state: draw dashed targeting HUD ring
              ctx.save();
              ctx.shadowBlur = 10;
              ctx.shadowColor = glowColor;
              ctx.strokeStyle = glowColor;
              ctx.lineWidth = 1.5;
              ctx.setLineDash([6, 6]);
              
              ctx.beginPath();
              const pulseRadius = Math.max(1, (38 * depthProj) + 8 + Math.sin(Date.now() * 0.01) * 3);
              ctx.arc(sx, sy, pulseRadius, 0, Math.PI * 2);
              ctx.stroke();

              // Label "GRAB"
              ctx.fillStyle = glowColor;
              ctx.font = 'bold 10px Inter, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText("GRAB", sx, sy - pulseRadius - 12);
              
              ctx.restore();
            }
          });
        });
      } else {
        // Draw Keyboard Control HUD Guides
        const drawKeyboardHUD = (orb, keyType) => {
          const depthProj = cameraDistance / Math.max(0.1, cameraDistance + orb.cz);
          const sx = centerX + orb.cx * scaleFactor * depthProj;
          const sy = centerY - orb.cy * scaleFactor * depthProj;
          const glowColor = getOrbGlowColor(keyType);
          const pulseRadius = Math.max(15, (38 * depthProj) + 15 + Math.sin(Date.now() * 0.005) * 3);
          
          ctx.save();
          ctx.shadowBlur = 15 * depthProj;
          ctx.shadowColor = glowColor;
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = 1.5;
          
          // 1. Draw elegant outer dashed circle
          ctx.setLineDash([4, 8]);
          ctx.beginPath();
          ctx.arc(sx, sy, pulseRadius, 0, Math.PI * 2);
          ctx.stroke();
          
          // 2. Draw outer solid corners/brackets
          ctx.setLineDash([]);
          const bracketSize = 8 * depthProj;
          // Top-Left corner
          ctx.beginPath();
          ctx.moveTo(sx - pulseRadius - bracketSize, sy - pulseRadius);
          ctx.lineTo(sx - pulseRadius, sy - pulseRadius);
          ctx.lineTo(sx - pulseRadius, sy - pulseRadius - bracketSize);
          ctx.stroke();
          
          // Top-Right corner
          ctx.beginPath();
          ctx.moveTo(sx + pulseRadius + bracketSize, sy - pulseRadius);
          ctx.lineTo(sx + pulseRadius, sy - pulseRadius);
          ctx.lineTo(sx + pulseRadius, sy - pulseRadius - bracketSize);
          ctx.stroke();
          
          // Bottom-Left corner
          ctx.beginPath();
          ctx.moveTo(sx - pulseRadius - bracketSize, sy + pulseRadius);
          ctx.lineTo(sx - pulseRadius, sy + pulseRadius);
          ctx.lineTo(sx - pulseRadius, sy + pulseRadius + bracketSize);
          ctx.stroke();
          
          // Bottom-Right corner
          ctx.beginPath();
          ctx.moveTo(sx + pulseRadius + bracketSize, sy + pulseRadius);
          ctx.lineTo(sx + pulseRadius, sy + pulseRadius);
          ctx.lineTo(sx + pulseRadius, sy + pulseRadius + bracketSize);
          ctx.stroke();
          
          // 3. Draw key layout below the orb
          const hudY = sy + pulseRadius + 22;
          ctx.font = 'bold 10px Inter, Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const keys = keysPressedRef.current;
          const isShift = !!(keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight']);
          
          const keySize = 16;
          const gap = 2;
          
          const drawKey = (label, relX, relY, isPressed, zLabel = '') => {
            const kX = sx + relX;
            const kY = hudY + relY;
            
            ctx.save();
            const rgb = hexToRgb(glowColor);
            if (isPressed) {
              ctx.fillStyle = glowColor;
              ctx.shadowBlur = 10;
              ctx.shadowColor = glowColor;
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(kX - keySize/2, kY - keySize/2, keySize, keySize, 3);
              } else {
                ctx.rect(kX - keySize/2, kY - keySize/2, keySize, keySize);
              }
              ctx.fill();
              ctx.fillStyle = '#050510';
            } else {
              ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;
              ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)`;
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(kX - keySize/2, kY - keySize/2, keySize, keySize, 3);
              } else {
                ctx.rect(kX - keySize/2, kY - keySize/2, keySize, keySize);
              }
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
            }
            
            ctx.fillText(isShift && zLabel ? zLabel : label, kX, kY);
            ctx.restore();
          };
          
          if (keyType === 'left') {
            // Draw WASD keys with layout/IME resilience
            const isWActive = keys['w'] || keys['W'] || keys['KeyW'] || keys['ㅈ'];
            const isAActive = keys['a'] || keys['A'] || keys['KeyA'] || keys['ㅁ'];
            const isSActive = keys['s'] || keys['S'] || keys['KeyS'] || keys['ㄴ'];
            const isDActive = keys['d'] || keys['D'] || keys['KeyD'] || keys['ㅇ'];

            drawKey('W', 0, 0, isWActive, 'Z+');
            drawKey('A', -keySize - gap, keySize + gap, isAActive);
            drawKey('S', 0, keySize + gap, isSActive, 'Z-');
            drawKey('D', keySize + gap, keySize + gap, isDActive);
            
            // Draw Shift Indicator
            const shiftX = sx;
            const shiftY = hudY + (keySize + gap) * 2 + 6;
            ctx.save();
            ctx.font = 'bold 8px Inter, sans-serif';
            if (isShift) {
              ctx.fillStyle = glowColor;
              ctx.shadowBlur = 8;
              ctx.fillText('SHIFT ACTIVE (Z-DEPTH)', shiftX, shiftY);
            } else {
              ctx.fillStyle = `rgba(${hexToRgb(glowColor).r}, ${hexToRgb(glowColor).g}, ${hexToRgb(glowColor).b}, 0.45)`;
              ctx.fillText('SHIFT + W/S FOR Z-DEPTH', shiftX, shiftY);
            }
            ctx.restore();
            
            // Add Z coordinate value and REAR indicator
            const isBehind = orb.cz > 0;
            if (isBehind) {
              ctx.save();
              ctx.fillStyle = '#ff007f'; // bright alert pink
              ctx.font = 'bold 9px Inter, sans-serif';
              ctx.fillText(`[REAR / 머리 뒤]`, sx, sy - pulseRadius - 24);
              ctx.restore();
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '9px monospace';
            ctx.fillText(`X: ${orb.cx.toFixed(2)} Y: ${orb.cy.toFixed(2)} Z: ${orb.cz.toFixed(2)}`, sx, sy - pulseRadius - 12);
          } else {
            // Draw Arrow keys
            const isArrowUpActive = keys['ArrowUp'];
            const isArrowDownActive = keys['ArrowDown'];
            const isArrowLeftActive = keys['ArrowLeft'];
            const isArrowRightActive = keys['ArrowRight'];

            drawKey('▲', 0, 0, isArrowUpActive, 'Z+');
            drawKey('◀', -keySize - gap, keySize + gap, isArrowLeftActive);
            drawKey('▼', 0, keySize + gap, isArrowDownActive, 'Z-');
            drawKey('▶', keySize + gap, keySize + gap, isArrowRightActive);
            
            // Draw Shift Indicator
            const shiftX = sx;
            const shiftY = hudY + (keySize + gap) * 2 + 6;
            ctx.save();
            ctx.font = 'bold 8px Inter, sans-serif';
            if (isShift) {
              ctx.fillStyle = glowColor;
              ctx.shadowBlur = 8;
              ctx.fillText('SHIFT ACTIVE (Z-DEPTH)', shiftX, shiftY);
            } else {
              ctx.fillStyle = `rgba(${hexToRgb(glowColor).r}, ${hexToRgb(glowColor).g}, ${hexToRgb(glowColor).b}, 0.45)`;
              ctx.fillText('SHIFT + ▲/▼ FOR Z-DEPTH', shiftX, shiftY);
            }
            ctx.restore();
            
            // Add Z coordinate value and REAR indicator
            const isBehind = orb.cz > 0;
            if (isBehind) {
              ctx.save();
              ctx.fillStyle = '#ff007f'; // bright alert pink
              ctx.font = 'bold 9px Inter, sans-serif';
              ctx.fillText(`[REAR / 머리 뒤]`, sx, sy - pulseRadius - 24);
              ctx.restore();
            }
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '9px monospace';
            ctx.fillText(`X: ${orb.cx.toFixed(2)} Y: ${orb.cy.toFixed(2)} Z: ${orb.cz.toFixed(2)}`, sx, sy - pulseRadius - 12);
          }
          
          ctx.restore();
        };
        
        drawKeyboardHUD(orbs.left, 'left');
        drawKeyboardHUD(orbs.right, 'right');
      }

      // 4.6 Draw hand cursors (clench responsive)
      hands.forEach(h => {
        const hX = (1 - h.x) * width;
        const hY = h.y * height;
        const isClosed = h.isFist;
        const hScaling = Math.max(1, (h.scale || 0.5) * (isClosed ? 250 : 450));
        
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // Outer glow
        const gradient = ctx.createRadialGradient(hX, hY, 0, hX, hY, hScaling);
        gradient.addColorStop(0, isClosed ? 'rgba(0, 255, 204, 0.45)' : 'rgba(255, 255, 255, 0.25)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(hX, hY, hScaling, 0, Math.PI * 2); ctx.fill();
        
        // Inner core
        ctx.beginPath();
        ctx.arc(hX, hY, isClosed ? 6 : 10, 0, Math.PI * 2);
        ctx.fillStyle = isClosed ? '#00ffcc' : 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 15;
        ctx.shadowColor = isClosed ? '#00ffcc' : '#ffffff';
        ctx.fill();
        
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', display: 'block' }} />
  );
}
