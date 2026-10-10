import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const rarity = z.enum(['Rare', 'Epic', 'Legendary']);

// Layers are front-to-back slices; each row reads left-to-right, top-to-bottom.
// A dot is empty space and digits index the deliberately small color palette.
const voxel = z.object({
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(10),
  layers: z.array(z.array(z.string().regex(/^[.0-9]+$/).min(1).max(16)).min(1).max(16)).min(1).max(8),
}).superRefine((model, ctx) => {
  const height = model.layers[0].length;
  const width = model.layers[0][0].length;
  let occupied = 0;
  for (const [depth, layer] of model.layers.entries()) {
    if (layer.length !== height) ctx.addIssue({ code: 'custom', path: ['layers', depth], message: 'Every voxel layer must have the same height.' });
    for (const [rowIndex, row] of layer.entries()) {
      if (row.length !== width) ctx.addIssue({ code: 'custom', path: ['layers', depth, rowIndex], message: 'Every voxel row must have the same width.' });
      for (const color of row) {
        if (color === '.') continue;
        occupied++;
        if (Number(color) >= model.palette.length) ctx.addIssue({ code: 'custom', path: ['layers', depth, rowIndex], message: 'Voxel color must reference a palette entry.' });
      }
    }
  }
  if (!occupied) ctx.addIssue({ code: 'custom', message: 'A voxel model must contain at least one occupied cell.' });
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string().min(1),
    tagline: z.string().min(1),
    description: z.string().min(1),
    category: z.enum(['Web apps', 'Creative tools']),
    rarity,
    stack: z.array(z.string().min(1)).min(1),
    skills: z.array(reference('skills')).min(1),
    voxel,
    year: z.string().min(1),
    order: z.number().int().nonnegative(),
    icon: z.string().min(1),
    image: z.string().min(1),
  }),
});

const skills = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/skills' }),
  schema: z.object({
    name: z.string().min(1),
    category: z.enum(['Frontend', 'Design', 'Workflow']),
    description: z.string().min(1),
    icon: z.string().min(1),
    rarity,
    order: z.number().int().nonnegative(),
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/experience' }),
  schema: z.object({
    title: z.string().min(1),
    period: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string().min(1)).min(1),
    order: z.number().int().nonnegative(),
  }),
});

export const collections = { projects, skills, experience };
