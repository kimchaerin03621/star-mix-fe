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
  NODE_SIZE: 0.045,
  NODE_SIZE_PER_LINK: 0.008,
  NODE_SIZE_RANDOM: 0.02,
};

// Region colors. The graph is white, so a white-ish instrument color would look empty;
// each instrument gets a clearly colored one here instead.
export const REGION_COLORS = {
  vocal: '#ff5c9d',
  drum: '#ffb347',
  bass: '#9b6bff',
  piano: '#6cc8ff',
  guitar: '#7be0a4',
};

// How a region (one instrument's colored area) is made and looks.
export const REGION = {
  HOPS: 4, // it spreads this many links from its sounding node
  REST_STRENGTH: 0.8, // how strongly colored it is while its instrument is quiet
  SOUND_STRENGTH: 0.45, // extra color when it sounds at full level
  HOVER_STRENGTH: 0.2, // extra color while pointed at or held
  SEED_STICKINESS: 0.2, // the sounding node moves only if another is this much nearer (stops flicker)
  FADE_OUT_PER_SECOND: 6,
  FADE_IN_PER_SECOND: 8,
};
