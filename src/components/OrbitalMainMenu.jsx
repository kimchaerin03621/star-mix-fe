import React, { useState, useEffect, useRef } from 'react';

export function OrbitalMainMenu({ onSelectMode }) {
  const [angle, setAngle] = useState(0);
  const [hoveredNode, setHoveredNode] = useState(null); // 'center' or 'mixer'
  const requestRef = useRef();

  useEffect(() => {
    let lastTime = performance.now();
    const animate = (time) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      // Continuous smooth orbit rotation counter-clockwise
      const speed = hoveredNode !== null ? 0.08 : 0.28; // rad per sec
      setAngle((prev) => (prev - speed * delta) % (Math.PI * 2));
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [hoveredNode]);

  // Ellipse parameters matching drawing
  const rx = 520; // horizontal radius in px
  const ry = 170; // vertical radius in px
  const tilt = -12; // tilt angle in deg
  const tiltRad = (tilt * Math.PI) / 180;

  // Calculate Sound Mixer position along orbit
  const unrotatedX = rx * Math.cos(angle);
  const unrotatedY = ry * Math.sin(angle);
  const mixerX = unrotatedX * Math.cos(tiltRad) - unrotatedY * Math.sin(tiltRad);
  const mixerY = unrotatedX * Math.sin(tiltRad) + unrotatedY * Math.cos(tiltRad);

  const depthFactor = Math.sin(angle);
  const mixerScale = 0.75 + (depthFactor + 1) * 0.22;
  const mixerOpacity = 0.7 + (depthFactor + 1) * 0.15;
  // If mixer is in back (depthFactor < 0), zIndex is lower than center (100). If in front, higher (200).
  const mixerZIndex = depthFactor < 0 ? 30 : 200;

  const isCenterHovered = hoveredNode === 'center';
  const isMixerHovered = hoveredNode === 'mixer';

  return (
    <div className="orbital-menu-overlay">
      <div className="orbit-stage">
        {/* Tilted Ellipse Orbit Track Line */}
        <svg className="orbit-svg" viewBox="-650 -300 1300 600">
          <ellipse
            cx="0"
            cy="0"
            rx={rx}
            ry={ry}
            fill="none"
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth="1.5"
            transform={`rotate(${tilt})`}
          />
        </svg>

        {/* --- CENTRAL FEATURE NODE: CONCERT HALL (Earth position) --- */}
        <div
          className={`orbit-node-wrapper central-node ${isCenterHovered ? 'hovered' : ''}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) scale(${isCenterHovered ? 1.05 : 1.0})`,
            zIndex: 100,
            cursor: 'pointer',
            transition: 'transform 0.3s ease',
          }}
          onMouseEnter={() => setHoveredNode('center')}
          onMouseLeave={() => setHoveredNode(null)}
          onClick={() => onSelectMode('vr2')}
        >
          <div className="orbit-orb-container" style={{ width: '320px', height: '320px' }}>
            {/* Volumetric Light Cloud Background */}
            <div
              className="orbit-cloud-layer"
              style={{
                background: `radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.45) 45%, transparent 75%)`,
                boxShadow: isCenterHovered
                  ? `0 0 90px #ffffff, 0 0 160px rgba(255, 255, 255, 0.9)`
                  : `0 0 50px rgba(255, 255, 255, 0.7), 0 0 90px rgba(255, 255, 255, 0.4)`,
                transform: isCenterHovered ? 'scale(1.1)' : 'scale(1.0)',
                opacity: isCenterHovered ? 0.95 : 0.8,
              }}
            />
            {/* Core Glowing Sphere */}
            <div
              className="orbit-orb"
              style={{
                background: `radial-gradient(circle at 45% 45%, 
                  #ffffff 0%, 
                  rgba(255, 255, 255, 0.98) 40%, 
                  rgba(240, 245, 255, 0.85) 65%, 
                  rgba(220, 230, 255, 0.35) 85%, 
                  rgba(0, 0, 0, 0) 100%)`,
                filter: isCenterHovered
                  ? `blur(6px) drop-shadow(0 0 35px #ffffff)`
                  : `blur(10px)`,
              }}
            />
          </div>
          <div
            className="orbit-label"
            style={{
              color: '#ffffff',
              fontSize: '20px',
              fontWeight: 'bold',
              letterSpacing: '1px',
              textShadow: isCenterHovered
                ? `0 0 15px #ffffff, 0 0 25px rgba(255, 255, 255, 0.9)`
                : `0 0 10px rgba(255, 255, 255, 0.8)`,
              marginTop: '20px'
            }}
          >
            Concert Hall
          </div>
        </div>

        {/* --- ORBITING SATELLITE NODE: SOUND MIXER (Moon position, ~27.3% ratio) --- */}
        <div
          className={`orbit-node-wrapper ${isMixerHovered ? 'hovered' : ''}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(${mixerX}px, ${mixerY}px) translate(-50%, -50%) scale(${isMixerHovered ? mixerScale * 1.3 : mixerScale})`,
            opacity: isMixerHovered ? 1.0 : mixerOpacity,
            zIndex: isMixerHovered ? 250 : mixerZIndex,
            cursor: 'pointer',
            transition: 'transform 0.15s ease-out, opacity 0.2s ease',
          }}
          onMouseEnter={() => setHoveredNode('mixer')}
          onMouseLeave={() => setHoveredNode(null)}
          onClick={() => onSelectMode('dj')}
        >
          <div className="orbit-orb-container" style={{ width: '88px', height: '88px' }}>
            <div
              className="orbit-cloud-layer"
              style={{
                background: `radial-gradient(circle at 40% 40%, #f8c8dcaa 0%, rgba(248, 200, 220, 0.6) 45%, transparent 75%)`,
                boxShadow: isMixerHovered
                  ? `0 0 45px #f8c8dc, 0 0 75px rgba(248, 200, 220, 0.8)`
                  : `0 0 20px rgba(248, 200, 220, 0.5), 0 0 40px rgba(248, 200, 220, 0.3)`,
                transform: isMixerHovered ? 'scale(1.3)' : 'scale(1.0)',
                opacity: isMixerHovered ? 0.9 : 0.65,
              }}
            />
            <div
              className="orbit-orb"
              style={{
                background: `radial-gradient(circle at 45% 45%, 
                  #ffffff 0%, 
                  rgba(255, 255, 255, 0.92) 20%, 
                  #f8c8dcaa 55%, 
                  rgba(248, 200, 220, 0.3) 80%, 
                  rgba(0, 0, 0, 0) 100%)`,
                filter: isMixerHovered
                  ? `blur(3px) drop-shadow(0 0 12px #f8c8dc)`
                  : `blur(4px)`,
              }}
            />
          </div>
          <div
            className="orbit-label"
            style={{
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 'bold',
              textShadow: isMixerHovered
                ? `0 0 15px #f8c8dc, 0 0 25px #f8c8dc`
                : `0 0 10px rgba(255, 255, 255, 0.7)`,
              marginTop: '8px'
            }}
          >
            Sound Mixer
          </div>
        </div>
      </div>
    </div>
  );
}
