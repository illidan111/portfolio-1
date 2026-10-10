/** Small, engine-free interactions shared by both portfolio views. */
export function mountContent(): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const filters = [...document.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const cards = [...document.querySelectorAll<HTMLElement>('[data-project][data-category]')];
  filters.forEach(button => button.addEventListener('click', () => {
    let count = 0;
    cards.forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
      if (!card.hidden) count++;
    });
    filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    const counter = document.getElementById('project-count');
    if (counter) counter.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    window.dispatchEvent(new Event('resize'));
  }, { signal }));
  const skills = [...document.querySelectorAll<HTMLButtonElement>('[data-skill]')];
  skills.forEach(button => button.addEventListener('click', () => {
    skills.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    for (const field of ['name', 'description', 'rarity', 'category']) {
      const target = document.getElementById(`skill-${field}`);
      if (target) target.textContent = button.dataset[field] ?? '';
    }
    const rarity = document.getElementById('skill-rarity');
    if (rarity) rarity.dataset.rarity = button.dataset.rarity?.toLowerCase() ?? '';
  }, { signal }));
  let opened: HTMLElement | undefined;
  const coarse = window.matchMedia('(pointer: coarse)');
  const trigger = (host: HTMLElement) => host.querySelector<HTMLElement>('[data-recipe-info]') ?? host;
  function closeTooltip(): void {
    if (!opened) return;
    delete opened.dataset.tapOpen;
    opened.dataset.tooltipHidden = 'true';
    if (opened.hasAttribute('data-recipe-result')) opened.dataset.tooltipDismissed = 'true';
    trigger(opened).setAttribute('aria-expanded', 'false');
    opened = undefined;
  }
  document.addEventListener('pointerdown', event => {
    if (opened && event.target instanceof Node && !opened.contains(event.target)) closeTooltip();
  }, { signal });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || document.documentElement.dataset.mode === 'classic') return;
    const info = event.target.closest('[data-recipe-info]');
    const host = info?.closest<HTMLElement>('[data-recipe-result]')
      ?? event.target.closest<HTMLElement>(coarse.matches ? '.buff, [data-skill]' : '.buff');
    if (!host) return;
    const same = opened === host;
    closeTooltip();
    if (same) return;
    opened = host;
    delete host.dataset.tooltipHidden;
    delete host.dataset.tooltipDismissed;
    host.dataset.tapOpen = 'true';
    trigger(host).setAttribute('aria-expanded', 'true');
  }, { signal });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeTooltip(); }, { signal });
  return () => { closeTooltip(); controller.abort(); };
}
