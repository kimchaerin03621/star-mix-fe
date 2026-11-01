import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { HAND_GESTURE_CONFIG as CONFIG } from './gestureConfig';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toScreenPoint = (hand) => ({
  x: 1 - hand.x,
  y: hand.y,
  ndcX: (1 - hand.x) * 2 - 1,
  ndcY: 1 - hand.y * 2,
});

const sameInteraction = (a, b) =>
  a.hoveredOrbKey === b.hoveredOrbKey &&
  a.grabbedOrbKey === b.grabbedOrbKey &&
  a.grabHandId === b.grabHandId &&
  a.mode === b.mode &&
  a.activeHandId === b.activeHandId;

export function WebcamGestureController({
  handData,
  stems,
  orbCoordsRef,
  draggingOrbsRef,
  orbitControlsRef,
  onInteractionChange,
  setIsDraggingOrb,
  visualFrameRef,
}) {
  const { camera, size } = useThree();
  const handDataRef = useRef(handData);
  const grabRef = useRef(null);
  const hoverMemoryRef = useRef(null);
  const orbitGestureRef = useRef(null);
  const interactionRef = useRef({
    hoveredOrbKey: null,
    grabbedOrbKey: null,
    grabHandId: null,
    mode: 'idle',
    activeHandId: null,
  });
  const raycasterRef = useRef(new THREE.Raycaster());
  const targetPointRef = useRef(new THREE.Vector3());
  const projectedRef = useRef(new THREE.Vector3());
  const orbitOffsetRef = useRef(new THREE.Vector3());
  const orbitSphericalRef = useRef(new THREE.Spherical());

  useEffect(() => {
    handDataRef.current = handData;
  }, [handData]);

  const publishInteraction = (next) => {
    if (!sameInteraction(interactionRef.current, next)) {
      interactionRef.current = next;
      onInteractionChange(next);
    }
  };

  const releaseGrab = () => {
    const grab = grabRef.current;
    if (grab) draggingOrbsRef.current[grab.orbKey] = false;
    grabRef.current = null;
    setIsDraggingOrb(false);
  };

  useFrame((_, delta) => {
    const hands = Array.isArray(handDataRef.current) ? handDataRef.current : [];
    const now = performance.now();
    let grab = grabRef.current;
    let hoveredOrbKey = null;

    // Priority 1: keep the grabbed hand locked by tracking id, with a proximity fallback.
    let grabHand = null;
    if (grab) {
      grabHand = hands.find((hand) => hand.trackingId === grab.handId);
      if (!grabHand && grab.lastScreenPoint) {
        let nearestDistance = Infinity;
        hands.forEach((hand) => {
          const point = toScreenPoint(hand);
          const distance = Math.hypot(point.x - grab.lastScreenPoint.x, point.y - grab.lastScreenPoint.y);
          if (distance < nearestDistance && distance < 0.22) {
            nearestDistance = distance;
            grabHand = hand;
          }
        });
      }

      if (!grabHand) {
        grab.lostFrames += 1;
        if (grab.lostFrames >= CONFIG.HAND_LOST_RELEASE_FRAMES) {
          releaseGrab();
          grab = null;
        }
      } else if (!grabHand.isFist) {
        releaseGrab();
        grab = null;
      } else {
        grab.lostFrames = 0;
        grab.handId = grabHand.trackingId;
        grab.lastScreenPoint = toScreenPoint(grabHand);
        const orb = orbCoordsRef.current[grab.orbKey];
        if (orb) {
          const point = grab.lastScreenPoint;
          raycasterRef.current.setFromCamera({ x: point.ndcX, y: point.ndcY }, camera);
          if (raycasterRef.current.ray.intersectPlane(grab.dragPlane, targetPointRef.current)) {
            // The drag plane is captured from the camera orientation at grab
            // start, so hand X/Y always maps to the visible screen plane.
            // dragOffset prevents a jump when the fist closes near, rather
            // than exactly on, the projected center of the star.
            orb.copy(targetPointRef.current).add(grab.dragOffset);
          }
        }
      }
    }

    // Priority 2: the opposite hand controls continuous depth only while grabbing.
    let secondaryDepthActive = false;
    let depthMode = null;
    let secondaryHand = null;
    if (grab && grabHand) {
      secondaryHand = hands.find((hand) => hand.trackingId !== grab.handId);
      const orb = orbCoordsRef.current[grab.orbKey];
      if (secondaryHand && orb) {
        const { thumb, index, middle, ring, pinky } = secondaryHand.fingers;
        // While grabbing, classify the secondary hand in context before Zoom.
        // A folded index can make Thumb Only resemble the pinch fallback used
        // by Zoom, but here the explicit one-finger poses always mean depth.
        const secondaryIndexOnly = !thumb && index && !middle && !ring && !pinky;
        const secondaryThumbOnly = thumb && !index && !middle && !ring && !pinky && !secondaryHand.isFist;

        if (secondaryIndexOnly) {
          const distanceFromListener = orb.distanceTo(camera.position);
          const availableDistance = CONFIG.MAX_LISTENER_DISTANCE - distanceFromListener;
          if (availableDistance > 0) {
            const moveDistance = Math.min(CONFIG.DEPTH_MOVE_SPEED * delta, availableDistance);
            const directionAwayFromListener = targetPointRef.current
              .copy(orb)
              .sub(camera.position)
              .normalize();
            orb.addScaledVector(directionAwayFromListener, moveDistance);
            grab.dragOffset.addScaledVector(directionAwayFromListener, moveDistance);
          }
          secondaryDepthActive = true;
          depthMode = 'depth-far';
        } else if (secondaryThumbOnly) {
          const distanceToListener = orb.distanceTo(camera.position);
          const availableDistance = distanceToListener - CONFIG.MIN_LISTENER_DISTANCE;
          if (availableDistance > 0) {
            const moveDistance = Math.min(CONFIG.DEPTH_MOVE_SPEED * delta, availableDistance);
            const directionToListener = targetPointRef.current
              .copy(camera.position)
              .sub(orb)
              .normalize();
            orb.addScaledVector(directionToListener, moveDistance);
            grab.dragOffset.addScaledVector(directionToListener, moveDistance);
          }
          secondaryDepthActive = true;
          depthMode = 'depth-near';
        }
      }
    }

    // Hover is evaluated only when idle. One globally nearest star wins.
    if (!grab) {
      let nearest = null;
      hands.filter((hand) => hand.gestures.openPalm).forEach((hand) => {
        const point = toScreenPoint(hand);
        stems.forEach((stem) => {
          const orb = orbCoordsRef.current[stem.key];
          if (!orb) return;
          projectedRef.current.copy(orb).project(camera);
          const distance = Math.hypot(projectedRef.current.x - point.ndcX, projectedRef.current.y - point.ndcY);
          if (distance <= CONFIG.HAND_HOVER_RADIUS && (!nearest || distance < nearest.distance)) {
            nearest = { distance, hand, orbKey: stem.key, point };
          }
        });
      });

      if (nearest) {
        hoveredOrbKey = nearest.orbKey;
        hoverMemoryRef.current = {
          orbKey: nearest.orbKey,
          handId: nearest.hand.trackingId,
          point: nearest.point,
          expiresAt: now + CONFIG.HOVER_GRACE_MS,
        };
      } else {
        const memory = hoverMemoryRef.current;
        if (memory && memory.expiresAt >= now) {
          const fistHand = hands.find((hand) => hand.trackingId === memory.handId && hand.isFist);
          if (fistHand) {
            const orb = orbCoordsRef.current[memory.orbKey];
            if (orb) {
              const grabPoint = toScreenPoint(fistHand);
              const dragPlaneNormal = camera.getWorldDirection(new THREE.Vector3()).normalize();
              const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(dragPlaneNormal, orb);
              const initialIntersection = new THREE.Vector3();
              raycasterRef.current.setFromCamera(
                { x: grabPoint.ndcX, y: grabPoint.ndcY },
                camera,
              );
              const hasIntersection = raycasterRef.current.ray.intersectPlane(
                dragPlane,
                initialIntersection,
              );

              grabRef.current = {
                orbKey: memory.orbKey,
                handId: fistHand.trackingId,
                dragPlane,
                dragOffset: hasIntersection
                  ? orb.clone().sub(initialIntersection)
                  : new THREE.Vector3(),
                lastScreenPoint: grabPoint,
                lostFrames: 0,
              };
              draggingOrbsRef.current[memory.orbKey] = true;
              setIsDraggingOrb(true);
              grab = grabRef.current;
              grabHand = fistHand;
              hoveredOrbKey = memory.orbKey;
              hoverMemoryRef.current = null;
            }
          }
        }
      }
    }

    // Priority 3/4: camera orbit or zoom. The grab hand is never eligible.
    const cameraHands = hands.filter((hand) => !grab || hand.trackingId !== grab.handId);
    const cameraMoveHand = secondaryDepthActive
      ? null
      : cameraHands.find((hand) => hand.gestures.cameraMove);
    const zoomHand = grab || cameraMoveHand || secondaryDepthActive
      ? null
      : cameraHands.find((hand) => hand.gestures.zoom);

    if (!cameraMoveHand) {
      orbitGestureRef.current = null;
    } else {
      const point = toScreenPoint(cameraMoveHand);
      const orbitState = orbitGestureRef.current;

      // Entering Orbit Mode only captures the start point. This prevents the
      // movement used to form the gesture from rotating the camera.
      if (!orbitState || orbitState.handId !== cameraMoveHand.trackingId) {
        orbitGestureRef.current = {
          handId: cameraMoveHand.trackingId,
          x: point.x,
          y: point.y,
          timestamp: cameraMoveHand.timestamp,
          yawDelta: 0,
          pitchDelta: 0,
        };
      } else if (orbitState.timestamp !== cameraMoveHand.timestamp) {
        const rawYawDelta = (point.x - orbitState.x) * CONFIG.CAMERA_ORBIT_SENSITIVITY;
        const rawPitchDelta = (point.y - orbitState.y) * CONFIG.CAMERA_ORBIT_SENSITIVITY;
        orbitState.yawDelta = THREE.MathUtils.lerp(
          orbitState.yawDelta,
          rawYawDelta,
          CONFIG.CAMERA_ORBIT_SMOOTHING,
        );
        orbitState.pitchDelta = THREE.MathUtils.lerp(
          orbitState.pitchDelta,
          rawPitchDelta,
          CONFIG.CAMERA_ORBIT_SMOOTHING,
        );

        const target = orbitControlsRef.current?.target || targetPointRef.current.set(0, 0, 0);
        const offset = orbitOffsetRef.current.copy(camera.position).sub(target);
        const spherical = orbitSphericalRef.current.setFromVector3(offset);
        const distance = spherical.radius;

        spherical.theta -= orbitState.yawDelta;
        spherical.phi = clamp(
          spherical.phi - orbitState.pitchDelta,
          CONFIG.CAMERA_MIN_POLAR_ANGLE,
          CONFIG.CAMERA_MAX_POLAR_ANGLE,
        );
        spherical.radius = distance;

        camera.position.copy(target).add(offset.setFromSpherical(spherical));
        camera.lookAt(target);
        orbitControlsRef.current?.update();

        orbitState.x = point.x;
        orbitState.y = point.y;
        orbitState.timestamp = cameraMoveHand.timestamp;
      }
    }

    hands.forEach((hand) => {

      if (zoomHand?.trackingId === hand.trackingId) {
        const angleRange = CONFIG.ZOOM_MAX_ANGLE - CONFIG.ZOOM_MIN_ANGLE;
        const normalizedAngle = clamp(
          (hand.thumbIndexAngle - CONFIG.ZOOM_MIN_ANGLE) / angleRange,
          0,
          1,
        );
        const target = orbitControlsRef.current?.target || new THREE.Vector3(0, 0, 0);
        const currentDistance = camera.position.distanceTo(target);
        // Closed fingers (0°) map to maximum distance; an L shape (90°)
        // maps to minimum distance. Ease toward the absolute target to avoid jumps.
        const targetDistance = THREE.MathUtils.lerp(
          CONFIG.CAMERA_MAX_DISTANCE,
          CONFIG.CAMERA_MIN_DISTANCE,
          normalizedAngle,
        );
        const frameSmoothing = 1 - Math.pow(1 - CONFIG.ZOOM_ANGLE_SMOOTHING, delta * 60);
        const nextDistance = THREE.MathUtils.lerp(currentDistance, targetDistance, frameSmoothing);
        const direction = camera.position.clone().sub(target).normalize();
        camera.position.copy(target).add(direction.multiplyScalar(nextDistance));
        orbitControlsRef.current?.update();
      }
    });

    let mode = 'idle';
    let activeHandId = null;
    if (grab) {
      mode = depthMode || (cameraMoveHand ? 'grab-camera-move' : zoomHand ? 'grab-zoom' : 'grab');
      activeHandId = depthMode
        ? secondaryHand?.trackingId ?? null
        : cameraMoveHand?.trackingId ?? zoomHand?.trackingId ?? grab.handId;
    } else if (cameraMoveHand) {
      mode = 'camera-move';
      activeHandId = cameraMoveHand.trackingId;
    } else if (zoomHand) {
      mode = 'zoom';
      activeHandId = zoomHand.trackingId;
    } else if (hoveredOrbKey) {
      mode = 'hover';
      activeHandId = hoverMemoryRef.current?.handId ?? null;
    }

    if (visualFrameRef) {
      const grabbedOrb = grab ? orbCoordsRef.current[grab.orbKey] : null;
      if (grabbedOrb) {
        projectedRef.current.copy(grabbedOrb).project(camera);
        visualFrameRef.current.grabbedOrbPoint = {
          x: (projectedRef.current.x * 0.5 + 0.5) * size.width,
          y: (-projectedRef.current.y * 0.5 + 0.5) * size.height,
        };
      } else {
        visualFrameRef.current.grabbedOrbPoint = null;
      }
    }

    publishInteraction({
      hoveredOrbKey: grab?.orbKey || hoveredOrbKey,
      grabbedOrbKey: grab?.orbKey || null,
      grabHandId: grab?.handId || null,
      mode,
      activeHandId,
    });
  });

  return null;
}
