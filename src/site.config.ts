/** Build-time switches. Disabled features render their ordinary, static fallback. */
export const features: Record<'hero' | 'lighting' | 'voxels' | 'digging' | 'weather' | 'transitions' | 'boss' | 'minimap' | 'crafting' | 'audio', boolean> = {
  hero: true,
  lighting: true,
  voxels: false,
  digging: false,
  weather: false,
  transitions: false,
  boss: false,
  minimap: false,
  crafting: false,
  audio: false,
};

export const profile = {
  github: 'https://github.com/illidan111',
  cv: '/alex-profile.txt',
};
