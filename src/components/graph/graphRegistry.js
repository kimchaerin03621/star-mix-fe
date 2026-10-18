// The instrument stars currently in the scene, so the white graph can color a region
// around each one. Each entry: { color, group (ref of the star's position),
// sound (ref: { vol, low, high, hit }), interaction (ref: { hovered, grabbed }) }.
const regions = new Map();

export const registerRegion = (key, entry) => regions.set(key, entry);
export const unregisterRegion = (key) => regions.delete(key);
export const getRegions = () => regions;
