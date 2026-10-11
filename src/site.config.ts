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
  name: 'Akzhol',
  role: 'Frontend engineer (placeholder)',
  experience: '2 years',
  coreStack: ['TypeScript', 'React', 'Astro'],
  availability: 'Availability: add status',
  email: 'you@example.com',
  github: 'https://github.com/illidan111',
  cv: '/cv.pdf',
  summary: 'Akzhol: 2 years of experience, Astana Explorer, Job Tracker and a playable Astro pixel world. Projects use JavaScript, TypeScript, React and Astro; employment history and contact details remain unconfirmed.',
  isPlaceholder: true,
};
