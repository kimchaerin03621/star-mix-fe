import React, { useState, useEffect, useRef } from 'react';

export function OrbitalMainMenu({ onSelectMode, onOpenEditor, onOpenController }) {
  const [angle, setAngle] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const requestRef = useRef();

  useEffect(() => {
    let lastTime = performance.now();
    const animate = (time) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      // Continuous smooth orbit rotation counter-clockwise (slow down slightly on hover for easy clicking)
      const speed = hoveredIdx !== null ? 0.08 : 0.28; // rad per sec
      setAngle((prev) => (prev - speed * delta) % (Math.PI * 2));
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [hoveredIdx]);

  const menuItems = [
    { 
      id: 'dj', 
      label: 'Sound Mixer', 
      description: '좌우 음성 섞어보기',
      color: '#f8c8dc', 
      glow: 'rgba(248, 200, 220, 0.6)',
      action: () => onSelectMode('dj') 
    },
    { 
      id: 'vr1', 
      label: 'Star Mixer', 
      description: '은하수 탐험하기',
      color: '#ffffff', 
      glow: 'rgba(255, 255, 255, 0.6)',
      action: () => onSelectMode('vr1') 
    },
    { 
      id: 'vr2', 
      label: 'Spatial Stems', 
      description: '음악을 분해하고 조립하기',
      color: '#f8c8dc', 
      glow: 'rgba(248, 200, 220, 0.6)',
      action: () => onSelectMode('vr2') 
    },
    { 
      id: 'voicecloud', 
      label: 'Voice Cloud', 
      description: '녹음해서 쌓아보기',
      color: '#ffffff', 
      glow: 'rgba(255, 255, 255, 0.6)',
      action: () => onSelectMode('voicecloud') 
    },
  ];

  // Ellipse parameters matching screenshot
  const rx = 380; // horizontal radius in px
  const ry = 120; // vertical radius in px
  const tilt = -12; // tilt angle in deg

  return (
    <div className="orbital-menu-overlay">
      {/* Top Left Logo */}
      <div className="channel-logo">
        WOOJOO PLAY
      </div>

      {/* Top Right Action Buttons (Star Edit & Control Room) */}
      <div className="top-right-actions">
        <button className="pill-btn" onClick={onOpenEditor}>
          Star Edit
        </button>
        <button className="pill-btn" onClick={onOpenController}>
          Control Room
        </button>
      </div>

      {/* Central Orbital Menu Container */}
      <div className="orbit-stage">
        {/* Tilted Ellipse Track Line */}
        <svg className="orbit-svg" viewBox="-500 -250 1000 500">
          <ellipse
            cx="0"
            cy="0"
            rx={rx}
            ry={ry}
            fill="none"
            stroke="rgba(255, 255, 255, 0.65)"
            strokeWidth="1.5"
            transform={`rotate(${tilt})`}
          />
        </svg>

        {/* 4 Orbital Menu Nodes */}
        {menuItems.map((item, index) => {
          const itemAngle = angle + (index * Math.PI) / 2;
          
          const unrotatedX = rx * Math.cos(itemAngle);
          const unrotatedY = ry * Math.sin(itemAngle);
          
          const tiltRad = (tilt * Math.PI) / 180;
          const x = unrotatedX * Math.cos(tiltRad) - unrotatedY * Math.sin(tiltRad);
          const y = unrotatedX * Math.sin(tiltRad) + unrotatedY * Math.cos(tiltRad);
          
          // 3D Depth scaling based on Y position along orbit
          const depthFactor = Math.sin(itemAngle);
          const scale = 0.8 + (depthFactor + 1) * 0.25;
          const opacity = 0.65 + (depthFactor + 1) * 0.175;
          const zIndex = Math.round((depthFactor + 1) * 50) + 10;
          const isHovered = hoveredIdx === index;

          return (
            <div
              key={item.id}
              className={`orbit-node-wrapper ${isHovered ? 'hovered' : ''}`}
              style={{
                transform: `translate(${x}px, ${y}px) scale(${isHovered ? scale * 1.25 : scale})`,
                opacity: isHovered ? 1.0 : opacity,
                zIndex: isHovered ? 250 : zIndex,
              }}
              onMouseEnter={() => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={item.action}
            >
              {/* Completely Borderless Volumetric Soft-Glow Celestial Light Cloud */}
              <div className="orbit-orb-container">
                {/* Amorphous Volumetric Light Cloud Background */}
                <div 
                  className="orbit-cloud-layer"
                  style={{
                    background: `radial-gradient(circle at 40% 40%, ${item.color}aa 0%, ${item.glow} 45%, transparent 75%)`,
                    boxShadow: isHovered
                      ? `0 0 50px ${item.color}, 0 0 90px ${item.glow}`
                      : `0 0 25px ${item.glow}, 0 0 50px ${item.color}33`,
                    transform: isHovered ? 'scale(1.3)' : 'scale(1.0)',
                    opacity: isHovered ? 0.9 : 0.6,
                  }}
                />
                {/* Core Volumetric Diffused Light Cloud Sphere (Gaussian Blurred Edge-free Boundary) */}
                <div 
                  className="orbit-orb" 
                  style={{
                    background: `radial-gradient(circle at 45% 45%, 
                      #ffffff 0%, 
                      rgba(255, 255, 255, 0.96) 25%, 
                      ${item.color}aa 55%, 
                      ${item.color}33 80%, 
                      rgba(0, 0, 0, 0) 100%)`,
                    filter: isHovered 
                      ? `blur(4px) drop-shadow(0 0 15px ${item.color})` 
                      : `blur(6px)`,
                  }}
                />
              </div>
              {/* Crisp Label Underneath */}
              <div 
                className="orbit-label"
                style={{
                  color: '#ffffff',
                  textShadow: isHovered
                    ? `0 0 15px ${item.color}, 0 0 25px ${item.color}`
                    : `0 0 10px rgba(255, 255, 255, 0.6)`,
                }}
              >
                {item.label}
              </div>
              {/* Subtitle / Description Text */}
              <div 
                className="orbit-desc"
                style={{
                  color: isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                  textShadow: isHovered ? `0 0 10px ${item.color}` : '0 0 6px rgba(0, 0, 0, 0.8)',
                  opacity: isHovered ? 1.0 : 0.8,
                }}
              >
                {item.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
