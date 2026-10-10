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
  crafting: true,
  audio: true,
};

export const profile = {
  name: 'Alex (demo)',
  role: 'Frontend engineer (placeholder)',
  experience: 'Experience: add years',
  coreStack: ['TypeScript', 'Astro'],
  availability: 'Availability: add status',
  email: 'you@example.com',
  github: 'https://github.com/illidan111',
  cv: '/cv.pdf',
  summary: 'An illustrative developer portfolio with original pixel art and concept projects. The name, role, experience, core stack, availability, and email are placeholders; no personal employment history has been supplied.',
  isPlaceholder: true,
};
