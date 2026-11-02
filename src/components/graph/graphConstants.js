// Where the listener's head is: the middle of the graph.
export const WHITE_GRAPH_CENTER = [0, 1.6, 0];

// The shape and size of the white graph. Tuning knobs, in meters unless noted.
export const GRAPH = {
  NODE_COUNT: 6000,
  INNER_RADIUS: 2.0, // nothing closer than this to the head (it would fill the view)
  OUTER_RADIUS: 8.5,
  FLATTEN: 0.75, // 1 = a ball; lower = squashed top to bottom
  CLUMP_COUNT: 48, // dense groups, like Obsidian's sections
  CLUMP_SHARE: 0.55, // share of nodes that sit in a clump
  CLUMP_SPREAD: 1.1,
  // Spots to keep empty: [x, y, z, radius]. The head, and where the desktop camera starts.
  KEEP_CLEAR: [[0, 1.6, 0, 2.0], [0, 1.6, 2, 1.7]],
  LINKS_PER_NODE: 3, // each node is joined to this many nearest neighbours
  MAX_LINK_LENGTH: 1.3,
  EXTRA_LINK_LENGTH: 0.5, // a third link only if that neighbour is this close
  // Crowded spots are thinned: at most CROWD_MAX nodes within CROWD_RADIUS (meters) of one another.
  CROWD_RADIUS: 0.5,
  CROWD_MAX: 9,
  NODE_SIZE: 0.045,
  NODE_SIZE_PER_LINK: 0.008,
  NODE_SIZE_RANDOM: 0.02,
  // The best-connected nodes are drawn as big bright hubs, like the nebula stars.
  HUB_SHARE: 0.07,
  HUB_SIZE: 0.13,
  HUB_SIZE_RANDOM: 0.05,
};

// The plain nodes and links (everything that is not part of a sounding region): flat, faint, no
// effects. ALPHA is how visible they are (0.1 = 10%).
export const PLAIN = {
  ALPHA: 0.06,
  SIZE_SCALE: 1.3, // plain dots are drawn this many times the node's size
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
  vocal: '#d4a63a',
  drum: '#56b4e9',
  bass: '#0072b2',
  piano: '#7b2048',
  guitar: '#7be0a4',
};

// How a region (one instrument's colored area) is made and looks.
export const REGION = {
  HOPS: 4, // it spreads this many links from its sounding node
  MIN_NODES: 34, // a region that starts in a sparse spot grows further until it has this many nodes
  MAX_HOPS: 8, // but never beyond this many links
  REST_STRENGTH: 0.8, // how strongly colored it is while its instrument is quiet
  SOUND_STRENGTH: 0.45, // extra color when it sounds at full level
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
