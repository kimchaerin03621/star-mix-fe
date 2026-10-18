// The nebulae currently on screen, so the bridges between neighbouring stars can
// find each one's layout, live state and transform. Each entry:
//   { layout, group, state, pullInput: { dir, amount }, color }
const nebulae = new Map();

export const registerNebula = (key, entry) => nebulae.set(key, entry);
export const unregisterNebula = (key) => nebulae.delete(key);
export const getNebulae = () => nebulae;
