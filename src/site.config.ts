/** Build-time switches. Disabled features render their ordinary, static fallback. */
export const features: Record<'hero' | 'lighting' | 'voxels' | 'digging' | 'weather' | 'transitions' | 'boss' | 'minimap' | 'crafting' | 'audio', boolean> = {
  hero: true,
  lighting: true,
  voxels: true,
  digging: true,
  weather: true,
  transitions: true,
  boss: true,
  minimap: true,
  crafting: false,
  audio: false,
};

export const profile = {
  github: 'https://github.com/illidan111',
  cv: '/alex-profile.txt',
};
