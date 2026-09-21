import { useEffect, useRef } from 'react';

const CURSOR_SMOOTHING = 0.38;

const screenPoint = (point, width, height) => ({
  x: (1 - point.x) * width,
  y: point.y * height,
});

export function HandGestureFeedback({ handData, interaction, visualFrameRef }) {
  const cursorRefs = useRef(new Map());
  const zoomRefs = useRef(new Map());
  const smoothedPointsRef = useRef(new Map());
  const grabLineRef = useRef(null);
  const handDataRef = useRef(handData);
  const interactionRef = useRef(interaction);
  handDataRef.current = handData;
  interactionRef.current = interaction;

  useEffect(() => {
    let animationFrame;
    const renderFeedback = () => {
      const currentHands = handDataRef.current;
      const currentInteraction = interactionRef.current;
      const width = window.innerWidth;
      const height = window.innerHeight;

      currentHands.forEach((hand) => {
      const target = screenPoint(hand, width, height);
      const smoothed = smoothedPointsRef.current.get(hand.trackingId) || { ...target };
      smoothed.x += (target.x - smoothed.x) * CURSOR_SMOOTHING;
      smoothed.y += (target.y - smoothed.y) * CURSOR_SMOOTHING;
      smoothedPointsRef.current.set(hand.trackingId, smoothed);

      const cursor = cursorRefs.current.get(hand.trackingId);
      if (cursor) cursor.style.transform = `translate3d(${smoothed.x}px, ${smoothed.y}px, 0)`;

      const zoomVisual = zoomRefs.current.get(hand.trackingId);
      if (zoomVisual) {
        const isZooming = currentInteraction.mode === 'zoom' && currentInteraction.activeHandId === hand.trackingId;
        zoomVisual.group.style.opacity = isZooming ? '1' : '0';
        if (isZooming) {
          const thumb = screenPoint(hand.thumbTip, width, height);
          const index = screenPoint(hand.indexTip, width, height);
          zoomVisual.line.setAttribute('x1', thumb.x);
          zoomVisual.line.setAttribute('y1', thumb.y);
          zoomVisual.line.setAttribute('x2', index.x);
          zoomVisual.line.setAttribute('y2', index.y);
          zoomVisual.thumb.setAttribute('cx', thumb.x);
          zoomVisual.thumb.setAttribute('cy', thumb.y);
          zoomVisual.index.setAttribute('cx', index.x);
          zoomVisual.index.setAttribute('cy', index.y);
        }
      }
    });

    if (grabLineRef.current) {
      const grabHandPoint = smoothedPointsRef.current.get(currentInteraction.grabHandId);
      const grabbedOrbPoint = visualFrameRef.current.grabbedOrbPoint;
      if (grabHandPoint && grabbedOrbPoint && currentInteraction.grabbedOrbKey) {
        grabLineRef.current.setAttribute('x1', grabHandPoint.x);
        grabLineRef.current.setAttribute('y1', grabHandPoint.y);
        grabLineRef.current.setAttribute('x2', grabbedOrbPoint.x);
        grabLineRef.current.setAttribute('y2', grabbedOrbPoint.y);
        grabLineRef.current.style.opacity = '1';
      } else {
        grabLineRef.current.style.opacity = '0';
      }
    }
      animationFrame = requestAnimationFrame(renderFeedback);
    };

    animationFrame = requestAnimationFrame(renderFeedback);
    return () => cancelAnimationFrame(animationFrame);
  }, [visualFrameRef]);

  return (
    <div className="hand-feedback-layer" aria-hidden="true">
        <svg className="hand-feedback-lines" width="100%" height="100%">
          <line ref={grabLineRef} className="hand-grab-line" />
          {handData.map((hand) => (
            <g
              key={`zoom-${hand.trackingId}`}
              ref={(group) => {
                if (!group) return;
                zoomRefs.current.set(hand.trackingId, {
                  group,
                  line: group.querySelector('line'),
                  thumb: group.querySelector('.zoom-thumb-point'),
                  index: group.querySelector('.zoom-index-point'),
                });
              }}
              className="hand-zoom-visual"
            >
              <line />
              <circle className="zoom-thumb-point" r="4" />
              <circle className="zoom-index-point" r="4" />
            </g>
          ))}
        </svg>

        {handData.map((hand) => {
          const isActive = interaction.activeHandId === hand.trackingId;
          const isHovered = isActive && interaction.mode === 'hover';
          const isGrabbed = interaction.grabHandId === hand.trackingId;
          const isDepthFar = isActive && interaction.mode === 'depth-far';
          const isDepthNear = isActive && interaction.mode === 'depth-near';
          const isOrbit = isActive && (
            interaction.mode === 'camera-move' || interaction.mode === 'grab-camera-move'
          );

          return (
            <div
              key={hand.trackingId}
              ref={(element) => {
                if (element) cursorRefs.current.set(hand.trackingId, element);
              }}
              className={`palm-cursor${isHovered ? ' hover' : ''}${isGrabbed ? ' grabbed' : ''}`}
            >
              {(isDepthFar || isDepthNear) && (
                <span className={`depth-indicator ${isDepthFar ? 'far' : 'near'}`} />
              )}
              {isOrbit && <span className="orbit-indicator" />}
            </div>
          );
        })}
    </div>
  );
}
