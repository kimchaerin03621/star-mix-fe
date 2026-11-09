import { getStemColor } from './songStems';

// Where the desktop camera comes to rest when the spatial scene opens: right by the middle of the
// ring of stems (they wrap around it), looking straight down -z with react-three-fiber's default
// 75deg fov. The camera flies in to here from a diagonal (see ENTRY_FLIGHT).
export const ENTRY_CAMERA_POSITION = [0, 1.6, 1];
export const ENTRY_CAMERA_TARGET = [0, 1.6, -2.9];
const ENTRY_CAMERA_FOV_DEGREES = 75;

// Where each stem's star first appears on screen (0..1 from the top-left), so
// the galaxy can split into clusters that line up with the spatial scene.
export function getStemScreenAnchors(stems, aspect) {
  const [camX, camY, camZ] = ENTRY_CAMERA_POSITION;
  const halfHeightPerDepth = Math.tan((ENTRY_CAMERA_FOV_DEGREES / 2) * (Math.PI / 180));

  return stems.map((stem) => {
    const [x, y, z] = stem.initialPos;
    const depth = camZ - z;
    const ndcX = (x - camX) / (depth * halfHeightPerDepth * aspect);
    const ndcY = (y - camY) / (depth * halfHeightPerDepth);
    return {
      key: stem.key,
      group: stem.group,
      color: getStemColor(stem),
      x: 0.5 + ndcX / 2,
      y: 0.5 - ndcY / 2,
    };
  });
}
