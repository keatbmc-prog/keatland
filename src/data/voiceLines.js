// The voice in the trees. Edit freely.
//
// From the Keatland story: the wind moves through the trees and a voice drifts out of them (or
// through the walls), stretching one word: "proooojects..." (Keaten's incurable condition), and
// once, "groooowth...". It is mostly that one word, from somewhere you cannot see.
//
// Fields
//   say       the word to synthesise (must have an entry in PHONEMES below, or give `phonemes`)
//   text      how the faint dissolving text spells it (set `showText: false` in voice.js to hide)
//   weight    relative chance of being picked
//   stretch   multiplier for how long the long vowel is drawn out (1 = ~1.7 s)
//   zones     where it can be heard: 'jungle', 'hub', 'gallery', 'story' (the Keatland Reception lot)
//   audio     optional: path to a recorded file (e.g. 'voice/projects-01.mp3' in public/voice/).
//             When set, the recording is played through the same spatial/wind chain instead of
//             the synthesiser. Leave undefined to synthesise.
//   phonemes  optional: custom phoneme list for a new word (see PHONEMES for the format)
export const VOICE_LINES = [
  { say: 'projects', text: 'proooojects…', weight: 10, stretch: 1.0, zones: ['jungle', 'hub', 'story'] },
  { say: 'projects', text: 'prooooojects…', weight: 7, stretch: 1.5, zones: ['jungle', 'hub', 'story'] },
  { say: 'projects', text: 'proooooooojects…', weight: 2, stretch: 2.3, zones: ['jungle'] },
  { say: 'growth', text: 'groooowth…', weight: 2.5, stretch: 1.3, zones: ['jungle', 'hub', 'story'] },
  { say: 'tomorrow', text: 'tomorroooow…', weight: 0.8, stretch: 1.2, zones: ['jungle'] },
  { say: 'jettison', text: 'jettisoooon…', weight: 0.6, stretch: 1.1, zones: ['jungle'] },
  { say: 'someday', text: 'somedaaaay…', weight: 0.6, stretch: 1.2, zones: ['jungle'] },
];

// How often (seconds, min..max) the voice drifts by in each zone. null = never.
export const VOICE_SCHEDULE = {
  jungle: [45, 120], jungleFirst: [10, 18],
  hub: [150, 320], hubFirst: [70, 120],
  gallery: null,
  story: [40, 110], storyFirst: [15, 25], // outside Reception it comes from the cottonwoods
};

// Phonemes: [symbol, seconds, flags]. Vowels/approximants/nasals are voiced through the formant
// filters; s, th, sh, f are noise; p, t, k, g, d, j are bursts. A segment flagged 'L' is the long,
// stretched vowel (its length is multiplied by the line's stretch). Diphthongs glide: 'oU', 'eI'.
export const PHONEMES = {
  projects: [['p', 0.05], ['r', 0.11], ['oU', 1.7, 'L'], ['j', 0.1], ['E', 0.16], ['k', 0.05], ['t', 0.04], ['s', 0.42]],
  growth: [['g', 0.05], ['r', 0.12], ['oU', 1.7, 'L'], ['w', 0.08], ['th', 0.5]],
  tomorrow: [['t', 0.05], ['@', 0.1], ['m', 0.1], ['A', 0.16], ['r', 0.1], ['oU', 1.7, 'L']],
  jettison: [['j', 0.1], ['E', 0.15], ['t', 0.05], ['I', 0.1], ['s', 0.14], ['oU', 1.5, 'L'], ['n', 0.4]],
  someday: [['s', 0.2], ['V', 0.13], ['m', 0.1], ['d', 0.05], ['eI', 1.8, 'L']],
};
