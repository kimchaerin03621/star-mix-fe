// Multi-track stem metadata shared by the galaxy (2D) and spatial (3D) scenes.
// `group` folds the stems into the two halves of the galaxy:
//   'lead' = the melody/vocal half, 'band' = every other instrument.
export const SONG_STEMS = {
  1: [
    { key: 'vocal', instrument: 'vocal', group: 'lead', name: '🎤 Vocal', color: '#e07a9e', url: '/Bohemian Rhapsody/Bohemian Rhapsody_vocal.mp3', initialPos: [-2.2, 1.6, -2.5] },
    { key: 'drum', instrument: 'drum', group: 'band', name: '🥁 Drums', color: '#e6e6e6', url: '/Bohemian Rhapsody/Bohemian Rhapsody_drum.mp3', initialPos: [2.2, 1.6, -2.5] },
    { key: 'bass', instrument: 'bass', group: 'band', name: '🎸 Bass', color: '#d4a843', url: '/Bohemian Rhapsody/Bohemian Rhapsody_bass.mp3', initialPos: [-1.5, 1.8, -3.8] },
    { key: 'piano', instrument: 'piano', group: 'band', name: '🎹 Piano', color: '#58b5b5', url: '/Bohemian Rhapsody/Bohemian Rhapsody_piano.mp3', initialPos: [1.5, 1.4, -3.8] },
    { key: 'guitar1', instrument: 'guitar', group: 'band', name: '🎸 Guitar 1', color: '#8d6fb3', url: '/Bohemian Rhapsody/Bohemian Rhapsody_electric guitar1.mp3', initialPos: [-2.5, 1.3, -4.5] },
    { key: 'guitar2', instrument: 'guitar', group: 'band', name: '🎸 Guitar 2', color: '#58ab75', url: '/Bohemian Rhapsody/Bohemian Rhapsody_electric guitar2.mp3', initialPos: [2.5, 1.3, -4.5] },
  ],
  2: [
    { key: 'lead_vocal', instrument: 'vocal', group: 'lead', name: '🎤 Vocal', color: '#e07a9e', url: '/Hype Boy/Hype Boy_vocal.mp3', initialPos: [-2.5, 1.6, -2.0] },
    { key: 'drums', instrument: 'drum', group: 'band', name: '🥁 Drums', color: '#e6e6e6', url: '/Hype Boy/Hype Boy_drum.mp3', initialPos: [2.5, 1.6, -2.0] },
    { key: 'bass', instrument: 'bass', group: 'band', name: '🎸 Bass', color: '#599ec7', url: '/Hype Boy/Hype Boy_bass.mp3', initialPos: [-1.8, 1.4, -3.8] },
    { key: 'piano', instrument: 'piano', group: 'band', name: '🎹 Piano', color: '#c99344', url: '/Hype Boy/Hype Boy_piano.mp3', initialPos: [1.8, 1.8, -3.8] },
  ],
  3: [
    { key: 'melody', instrument: 'piano', group: 'lead', name: '🎹 Piano', color: '#e07a9e', url: '/Kerning City/Kerning City_piano.mp3', initialPos: [-2.0, 1.6, -2.5] },
    { key: 'drum', instrument: 'drum', group: 'band', name: '🥁 Drums', color: '#e6e6e6', url: '/Kerning City/Kerning City_drum.mp3', initialPos: [2.0, 1.6, -2.5] },
    { key: 'bass', instrument: 'bass', group: 'band', name: '🎸 Bass', color: '#9662c4', url: '/Kerning City/Kerning City_bass.mp3', initialPos: [-1.2, 1.5, -3.2] },
  ],
};

// The exhibition plays a single song so the galaxy and the spatial scene
// always share the same stems.
export const EXHIBITION_SONG = 2;

export const getStemGroupUrls = (songId) => {
  const stems = SONG_STEMS[songId] || SONG_STEMS[EXHIBITION_SONG];
  const urlsFor = (group) => stems.filter((stem) => stem.group === group).map((stem) => stem.url);
  return { lead: urlsFor('lead'), band: urlsFor('band') };
};
