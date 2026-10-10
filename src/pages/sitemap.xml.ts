import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const entities: Record<string, string> = {
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
};
const xml = (value: string): string => value.replace(/[<>&"']/g, character => entities[character]!);

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('Astro site must be configured.');
  const projects = await getCollection('projects');
  const routes = ['/', ...projects.map(project => `/projects/${project.id}/`).sort()];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    routes.map(route => `  <url><loc>${xml(new URL(route, site).href)}</loc></url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
