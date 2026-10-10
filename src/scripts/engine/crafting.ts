import { matchingRecipes, type RecipeData } from '../../lib/recipes';
import { settings } from './settings';

/** Ordinary DOM controls: no game loop is needed for the crafting table. */
export function mountCrafting(): () => void {
  const root = document.querySelector<HTMLElement>('[data-crafting-table]');
  if (!root?.dataset.recipes) return () => {};
  let data: RecipeData;
  try { data = JSON.parse(root.dataset.recipes) as RecipeData; }
  catch { return () => {}; }
  const add = root.querySelector<HTMLButtonElement>('[data-add-ingredient]')!;
  const reset = root.querySelector<HTMLButtonElement>('[data-reset-recipe]')!;
  const ingredients = root.querySelector<HTMLUListElement>('[data-recipe-ingredients]')!;
  const status = root.querySelector<HTMLElement>('[data-craft-status]')!;
  const note = root.querySelector<HTMLElement>('[data-ingredient-note]')!;
  const counter = root.querySelector<HTMLElement>('[data-ingredient-count]')!;
  const count = root.querySelector<HTMLElement>('[data-recipe-count]')!;
  const empty = root.querySelector<HTMLElement>('[data-empty-ingredients]')!;
  const skillButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-skill]')];
  const cards = [...document.querySelectorAll<HTMLElement>('[data-project-id]')];
  const results = [...root.querySelectorAll<HTMLElement>('[data-recipe-result]')];
  const names = new Map(data.skills.map(skill => [skill.id, skill.name]));
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const selected: string[] = [];
  let inspected: string | undefined = skillButtons.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.skill ?? data.skills[0]?.id;
  let animationTimer: ReturnType<typeof setTimeout> | undefined;

  function syncAdd(): void {
    const name = inspected ? names.get(inspected) : undefined;
    const included = !!inspected && selected.includes(inspected);
    add.disabled = !name || included || selected.length === 3;
    add.textContent = included ? `${name} added` : selected.length === 3 ? 'Recipe full' : `Add ${name ?? 'a skill'}`;
    note.textContent = included ? 'This ingredient is already in your recipe. Inspect another skill to add more.'
      : selected.length === 3 ? 'Three good ingredients. Remove one to try a different combination.'
      : 'Up to three skills. Each one brings something to the table.';
    reset.disabled = selected.length === 0;
  }

  function stopAnimation(): void {
    clearTimeout(animationTimer);
    delete root!.dataset.crafting;
  }

  function render(announce = false): void {
    ingredients.replaceChildren();
    for (const id of selected) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const label = document.createElement('span');
      const remove = document.createElement('span');
      label.textContent = names.get(id)!;
      remove.textContent = '×';
      remove.setAttribute('aria-hidden', 'true');
      button.type = 'button'; button.dataset.removeIngredient = id;
      button.setAttribute('aria-label', `Remove ${names.get(id)} from recipe`);
      button.append(label, remove); item.append(button); ingredients.append(item);
    }
    empty.hidden = selected.length > 0;
    counter.textContent = `${selected.length} / 3 skills`;
    const matches = matchingRecipes(data.projects, selected);
    const ids = new Set(matches.map(project => project.id));
    for (const result of results) {
      result.hidden = !ids.has(result.dataset.recipeResult!);
      const project = data.projects.find(project => project.id === result.dataset.recipeResult)!;
      result.querySelector<HTMLElement>('[data-recipe-tooltip]')!.textContent = selected.length
        ? `Shared ingredients: ${selected.map(id => names.get(id)).join(', ')}. ${project.title} uses every skill in this recipe.`
        : `Project skills: ${project.skills.map(id => names.get(id)).join(', ')}.`;
    }
    cards.forEach(card => {
      if (selected.length && ids.has(card.dataset.projectId!)) card.dataset.recipeMatch = 'true';
      else delete card.dataset.recipeMatch;
    });
    count.textContent = selected.length ? `${matches.length} ${matches.length === 1 ? 'matching project' : 'matching projects'}` : `${data.projects.length} projects to explore`;
    if (announce) {
      status.textContent = !selected.length ? 'Recipe cleared. Inspect a skill above and add it to the table.'
        : matches.length ? `${matches.length} ${matches.length === 1 ? 'project matches' : 'projects match'} ${selected.length === 1 ? 'this ingredient' : `all ${selected.length} ingredients`}: ${selected.map(id => names.get(id)).join(', ')}. ${matches.map(project => project.title).join(', ')}.`
        : `No project uses all ${selected.length} ingredients yet. Remove a skill to try another recipe.`;
    }
    syncAdd();
  }

  skillButtons.forEach(button => button.addEventListener('click', () => {
    inspected = button.dataset.skill;
    syncAdd();
  }, options));
  add.addEventListener('click', () => {
    if (!inspected || selected.includes(inspected) || selected.length >= 3 || !names.has(inspected)) return;
    selected.push(inspected);
    render(true);
    stopAnimation();
    if (!settings.isReduced()) {
      root.dataset.crafting = 'true';
      animationTimer = setTimeout(stopAnimation, 360);
    }
    if (matchingRecipes(data.projects, selected).length) document.dispatchEvent(new CustomEvent('pixel:sound', { detail: 'craft' }));
    ingredients.querySelector<HTMLButtonElement>('li:last-child button')?.focus({ preventScroll: true });
  }, options);
  ingredients.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-remove-ingredient]') : null;
    const index = button ? selected.indexOf(button.dataset.removeIngredient!) : -1;
    if (index < 0) return;
    selected.splice(index, 1); stopAnimation(); render(true);
    (ingredients.querySelectorAll<HTMLButtonElement>('button')[Math.min(index, selected.length - 1)] ?? add).focus({ preventScroll: true });
  }, options);
  reset.addEventListener('click', () => {
    selected.length = 0; stopAnimation(); render(true); add.focus({ preventScroll: true });
  }, options);
  results.forEach(result => {
    result.addEventListener('keydown', event => { if (event.key === 'Escape') result.dataset.tooltipDismissed = 'true'; }, options);
    result.addEventListener('pointerleave', () => { delete result.dataset.tooltipDismissed; }, options);
    result.addEventListener('focusout', () => { delete result.dataset.tooltipDismissed; }, options);
  });
  const unsubscribe = settings.subscribe(() => { if (settings.isReduced()) stopAnimation(); });
  render();
  root.dataset.ready = 'true';
  return () => {
    controller.abort(); unsubscribe(); stopAnimation();
    cards.forEach(card => { delete card.dataset.recipeMatch; });
  };
}
