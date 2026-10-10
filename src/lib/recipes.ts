import type { CollectionEntry } from 'astro:content';

export interface RecipeSkill { id: string; name: string; }
export interface RecipeProject { id: string; title: string; skills: string[]; }
export interface RecipeData { skills: RecipeSkill[]; projects: RecipeProject[]; }

/** Run during prerendering as well as before assembling the crafting table. */
export function assertRecipeSkills(projects: CollectionEntry<'projects'>[], skills: CollectionEntry<'skills'>[]): void {
  const ids = new Set(skills.map(skill => skill.id));
  for (const project of projects) {
    for (const skill of project.data.skills) {
      if (!ids.has(skill.id)) throw new Error(`Project "${project.id}" references unknown skill "${skill.id}".`);
    }
  }
}

export function recipeData(projects: CollectionEntry<'projects'>[], skills: CollectionEntry<'skills'>[]): RecipeData {
  assertRecipeSkills(projects, skills);
  return {
    skills: skills.map(skill => ({ id: skill.id, name: skill.data.name })),
    projects: projects.map(project => ({ id: project.id, title: project.data.title, skills: project.data.skills.map(skill => skill.id) })),
  };
}

export function matchingRecipes(projects: RecipeProject[], ingredients: readonly string[]): RecipeProject[] {
  return projects.filter(project => ingredients.every(skill => project.skills.includes(skill)));
}
