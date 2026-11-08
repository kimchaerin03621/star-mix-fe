// Where the listener's head is: the middle of the graph.
export const WHITE_GRAPH_CENTER = [0, 1.6, 0];

// The shape and size of the white graph. Tuning knobs, in meters unless noted.
export const GRAPH = {
  NODE_COUNT: 20000, // very many: the space reads as a dense field of light (watch the headset's frame rate; 7000 was the earlier amount)
  INNER_RADIUS: 2.0, // nothing closer than this to the head (it would fill the view)
  OUTER_RADIUS: 8.5,
  FLATTEN: 0.75, // 1 = a ball; lower = squashed top to bottom
  CLUMP_COUNT: 48, // dense groups, like Obsidian's sections
  CLUMP_SHARE: 0, // share of nodes that sit in a clump (none: the spacing stays even)
  CLUMP_SPREAD: 1.6,
  MIN_SPACING: 0.33, // no two nodes closer than this (meters); small enough that NODE_COUNT fits
  // Spots to keep empty: [x, y, z, radius]. The head, and where the desktop camera starts.
  KEEP_CLEAR: [[0, 1.6, 0, 2.0], [0, 1.6, 2, 1.7]],
  LINKS_PER_NODE: 3, // each node is joined to this many nearest neighbours
  MAX_LINK_LENGTH: 1.3,
  EXTRA_LINK_LENGTH: 0.5, // a third link only if that neighbour is this close
  // Crowded spots are thinned: at most CROWD_MAX nodes within CROWD_RADIUS (meters) of one another.
  CROWD_RADIUS: 0.5,
  CROWD_MAX: 40,
  NODE_SIZE: 0.045, // every node is this size (smaller, since there are many more)
};

// A headset draws the scene twice (once per eye) on a phone-class chip, so it gets a lighter graph.
// These replace the GRAPH values above when the page runs in a headset's own browser (or `?vr`).
export const HEADSET_GRAPH = {
  NODE_COUNT: 7000, // the amount known to run smoothly on the headset
  MIN_SPACING: 0.5,
  CROWD_MAX: 9,
  NODE_SIZE: 0.06,
  PLAIN_ALPHA_SCALE: 1.7, // fewer dots and links add up to less light, so each is drawn a little brighter
  REGION_HOPS: 4, // each region is drawn with its own colored nodes, lines and glow, so on a headset it stays as small as it was
  REGION_MIN_NODES: 34,
};
export const isHeadsetBrowser = typeof window !== 'undefined'
  && (window.__headsetGraph === true // set by the headset emulator in the tests
    || new URLSearchParams(window.location.search).has('vr')
    || new URLSearchParams(window.location.search).has('lobby')
    || /OculusBrowser|Quest/i.test(window.navigator?.userAgent ?? ''));

// The plain nodes and links (everything that is not part of a sounding region): flat, faint, no
// effects. ALPHA is how visible they are (0.1 = 10%).
export const PLAIN = {
  ALPHA: 0.035, // lower than before: there are about three times as many dots and links to add up
  SIZE_SCALE: 1.3, // plain dots are drawn this many times the node's size
  // Depth: near dots are bigger and brighter, far ones smaller and fainter, so the space reads as deep.
  DEPTH_RANGE: [2.5, 8], // distances (meters) between which it goes from "near" to "far"
  NEAR_GAIN: 1.7, // near dots: ALPHA times this
  FAR_GAIN: 0.18, // far dots: ALPHA times this (low: the far space melts into the dark)
  NEAR_SIZE: 1.7, // near dots: size times this
  FAR_SIZE: 0.7,
  MAX_SCREEN_SIZE: 0.14, // no plain dot is drawn bigger than this share of its distance to the eye
};

// How the whole graph moves, slowly, like something alive.
export const MOTION = {
  DISTANCE: 0.2, // how far the shared current carries a node (meters, at most); kept small so nodes do not all move together
  SPEED: 0.12, // how fast it flows (slow and lazy)
  FINE: 0.4, // the second, tighter layer of swell, as strong as this share of the broad one
  SCALE: 0.26, // how big its swells are: lower = broader (nearby nodes move together)
  OWN: 0.1, // each node's own drift (meters): this is what makes every node look alive on its own
  OWN_SPEED: [0.3, 0.9], // how fast a node drifts (radians per second); each picks its own, so they never move in step
};

// The fine hairlines that make a colored region look like a woven volume (and the white lines that
// tie the regions together). The more lines, the denser and more solid a region reads.
export const WEB = {
  PER_NODE: 40, // each node of a region reaches out to this many others of the same region
  RADIUS: 1.3, // ...within this distance (meters)
  MAX_PER_REGION: 1800,
  ALPHA: 0.8, // one hairline; many overlapping lines build up the color
  PASTEL: 0.3, // the far end of each line is its color pulled this far toward white
  CONNECT_PER_PAIR: 26, // white lines from one region to another, per pair of regions
  CONNECT_ALPHA: 0.12,
  MAX_CONNECT: 400,
};

// Waves that run through the nodes with the music (gentle: the graph stays in place).
export const WAVE = {
  RIPPLE: 0, // how far a node is pushed by a region's wave at full volume (meters)
  SPEED: 1.6, // how fast the wave travels outward
  FREQUENCY: 2.2, // lower = wider waves
  REACH: 0.45, // lower = the wave carries farther before it fades
  MUSIC_BOOST: 0.6, // the whole graph's slow flow gets this much bigger when the music is loud
};

// A hit (above all a drum stroke) sends one thin shell of light out through the whole graph, from
// the instrument's star to the far edge: you see the sound cross the space. Rare and large, not busy.
export const SHOCK = {
  SPEED: 6, // how fast the shell travels (m/s); the graph is ~9 m deep, so it crosses in about 1.5 s
  WIDTH: 0.8, // thickness of the shell (m)
  FADE: 0.85, // how fast it dies away over time
  ALPHA: 0.3, // how bright the nodes and links it passes through get (kept faint: it should be felt more than seen)
  // How strongly each instrument sends a shell: the drum is the big one.
  WEIGHT: { drum: 1, bass: 0.9, piano: 0.8, guitar: 0.8, vocal: 0.8 },
  SLOTS: 4, // how many shells of one star can travel at once: a new one never cuts off the one before
  SUSTAIN_VOLUME: 0.12, // a star that keeps sounding above this loudness sends a shell every...
  SUSTAIN_EVERY: 1.4, // ...this many seconds, even with no sharp hit (vocal, piano)
  // The region itself moves with the sound: it swells from its center as its instrument gets louder
  // (and a little more on each hit), and settles as it quiets.
  RECOIL: 0.1, // how far (a share of each node's distance from the region's center) at full sound
  RECOIL_HIT: 0.5, // how much of that a sharp hit adds on top of the steady loudness
  RECOIL_RISE: 14, // how fast it follows the sound getting louder (higher = sharper)
  RECOIL_FALL: 4, // how fast it settles when the sound drops
  // The whole graph swells a hair with the bass, slowly, like the room breathing (a share of the distance from the center).
  BREATH: 0.018,
};

// Holding a region and moving it: the nodes around it follow like a liquid (a little behind, a little
// stretched), then settle back to where they were.
export const LIQUID = {
  RADIUS: 0.9, // how far around the star the nodes are affected (meters)
  LAG_GAIN: 0.9, // how much of the star's lag the nodes show
  PULL: 0.08, // while held, the nodes around it lean toward the star by this much
  MAX_OFFSET: 0.7, // the lag never stretches farther than this (meters)
  SPRING: 48, // how hard the lagging point is pulled to the star (higher = quicker to follow)
  DAMPING: 6.5, // lower = it overshoots and wobbles more, like pudding (above about 2x the square root of SPRING it flows like water)
  VARIANTS: 6, // how many different springs there are; every node follows one of them (or a blend), so each wobbles on its own
  JIGGLE: 0.03, // while it is being moved, each node keeps jiggling, this much per m/s of the star's speed (meters)
  SPREAD: 0.55, // how different they are: 0 = all alike (one blob), higher = each node more on its own
};

// Plain nodes that stand between the eye and a colored region are hidden, so they never clutter
// the view of what is sounding.
export const OCCLUDER = {
  PERCENTILE: 0.8, // the region is as wide as this share of its nodes
  EXTRA_RADIUS: 0.3, // plus this much (meters), so the edge of the region is cleared too
  DEPTH_FADE: 0.6, // nodes within this distance of the region's depth fade in gradually
};

// Region colors. The graph is white, so a white-ish instrument color would look empty;
// each instrument gets a clearly colored one here instead.
export const REGION_COLORS = {
  vocal: '#d9788f',
  drum: '#e9b26c',
  bass: '#3f9ea6',
  piano: '#7f74d4',
  guitar: '#7be0a4',
};

// A colored region seen near or far: close, it is bigger and brighter; far, smaller and faint. Strong on
// purpose, so pushing a region away or pulling it in (above all in the headset) is plain to see.
export const REGION_DEPTH = {
  RANGE: [2, 9], // distances (meters) between which it goes from "near" to "far"
  NEAR_SIZE: 1.7, // nodes up close: size times this
  FAR_SIZE: 0.45, // nodes far away: size times this
  NEAR_GAIN: 1.15, // up close: brightness times this
  FAR_GAIN: 0.22, // far away: brightness times this
};

// How a region (one instrument's colored area) is made and looks.
export const REGION = {
  HOPS: 5, // it spreads this many links from its sounding node
  MIN_NODES: 150, // a region that starts in a sparse spot grows further until it has this many nodes
  MAX_HOPS: 9, // but never beyond this many links
  REST_STRENGTH: 0.55, // how strongly colored it is while its instrument is quiet (lower than the sounding ones, so the one that plays stands out)
  SOUND_STRENGTH: 0.7, // extra color when it sounds at full level
  SOUND_RISE: 3, // how fast color follows the music up (per second; lower = lazier)
  SOUND_FALL: 1.2, // and how fast it sinks back
  HOVER_STRENGTH: 0.2, // extra color while pointed at or held
  SEED_STICKINESS: 0.2, // the sounding node moves only if another is this much nearer (stops flicker)
  FADE_OUT_PER_SECOND: 6,
  FADE_IN_PER_SECOND: 8,
};

// How a region shows that it is being pointed at (palm, mouse, controller) or held. It only
// gets bigger and brighter, gently; nothing is added on top and nothing else is dimmed.
export const FOCUS = {
  HOVER: 0.6, // pointed at
  HELD: 1, // grabbed
  GROW: 0.7, // nodes grow by this much at full focus
  BRIGHTEN: 0.5, // and get this much brighter
  HALO: 2.5, // the soft glow behind the region gets this much stronger
  BREATH: 0.12, // pointed-at regions breathe by this much; a held region is steady
  EASE_PER_SECOND: 10,
};

// The lobby a headset visitor first sees (`?lobby`): the logo and an enter button in front, and sound
// nodes all around that you swish with the controllers. Where they end up sets the left/right balance
// of the one song that plays.
export const LOBBY = {
  NODE_COUNT: 480,
  NEAREST: 0.9, // no node closer than this to the head (meters)
  FARTHEST: 6.5,
  HEIGHT: [0.2, 3.3],
  CLEAR_CONE_DEGREES: 30, // the front stays free for the logo and the button...
  CLEAR_DISTANCE: 3.6, // ...out to this distance
  NODE_SIZE: [0.03, 0.07], // like the nodes of the main space: small and crisp
  TOUCH_RADIUS: 0.45, // a controller pushes nodes this close to it
  PUSH: 5, // how hard
  SPRING: 0.7, // how firmly a node is drawn back home (low: it lingers where you left it, then drifts back)
  DAMPING: 0.9,
  MAX_OFFSET: 6, // a node never strays farther than this from home
  IDLE_DRIFT: 0.06, // each node's own slow drift (meters)
  BALANCE_REACH: 3, // a node counts fully left or right at this distance from the middle (meters)
  BALANCE_GAIN: 3, // how strongly the nodes' overall drift tilts the sound
  PAN_EASE: 0.12, // seconds the sound takes to follow
  LEFT_COLOR: '#d9788f',
  RIGHT_COLOR: '#7f74d4',
  VOLUME: 0.35,
  LOGO: { position: [0, 2.0, -2.2], size: [1.7, 0.42] },
  BUTTON: { position: [0, 1.5, -2.2], size: [1.0, 0.24] },
};
