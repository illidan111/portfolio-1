import { features } from '../../site.config';
import { settings } from './settings';

const landmarks = ['home', 'projects', 'skills', 'about', 'contact'] as const;
type Landmark = typeof landmarks[number];
const memory = new Set<Landmark>();
let expanded: boolean | undefined;

function validLandmark(value: unknown): value is Landmark {
  return typeof value === 'string' && (landmarks as readonly string[]).includes(value);
}

function readVisited(): void {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('pixel-map-visited') ?? '[]');
    if (Array.isArray(saved)) saved.forEach(value => { if (validLandmark(value)) memory.add(value); });
  } catch { /* Exploring still works when saved preferences are unavailable. */ }
}

export function mountMinimap(): () => void {
  const element = document.querySelector<HTMLDetailsElement>('[data-minimap]');
  if (!features.minimap || !element) return () => {};
  const map = element;
  readVisited();
  const controller = new AbortController();
  const { signal } = controller;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const links = [...map.querySelectorAll<HTMLAnchorElement>('[data-map-landmark]')];
  const mobile = window.matchMedia('(max-width: 700px)');
  const container = map.closest<HTMLElement>('.minimap');
  const toast = document.getElementById('achievement-toast');
  const summary = map.querySelector('summary');
  function placeAboveToast(): void {
    const offset = toast && !toast.hidden ? window.innerHeight - toast.getBoundingClientRect().top + 16 : 0;
    container?.style.setProperty('--map-toast-offset', `${Math.max(0, Math.ceil(offset))}px`);
  }
  const toastSize = new ResizeObserver(placeAboveToast);
  const toastVisibility = new MutationObserver(placeAboveToast);
  if (toast) {
    toastSize.observe(toast);
    toastVisibility.observe(toast, { attributes: true, attributeFilter: ['hidden'] });
  }
  window.addEventListener('resize', placeAboveToast, { signal, passive: true });
  placeAboveToast();
  map.open = expanded ?? !mobile.matches;
  map.addEventListener('toggle', () => { expanded = map.open; }, { signal });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !map.open || document.querySelector('dialog[open]')) return;
    event.preventDefault(); event.stopPropagation();
    map.open = false;
    summary?.focus({ preventScroll: true });
  }, { signal });
  map.addEventListener('click', event => {
    if (!mobile.matches || !(event.target instanceof Element)) return;
    const link = event.target.closest('a');
    if (link && link.getAttribute('aria-disabled') !== 'true') { map.open = false; expanded = false; }
  }, { signal });

  function paint(): void {
    links.forEach(link => {
      const id = link.dataset.mapLandmark;
      const visited = validLandmark(id) && memory.has(id);
      link.dataset.visited = String(visited);
      link.setAttribute('aria-label', `${link.dataset.mapLabel} — ${visited ? 'visited' : 'unvisited'}`);
      if (visited) { link.removeAttribute('aria-disabled'); link.removeAttribute('tabindex'); }
      else { link.setAttribute('aria-disabled', 'true'); link.tabIndex = -1; }
    });
    map.querySelectorAll<HTMLElement>('[data-map-state]').forEach(state => {
      const id = state.dataset.mapState;
      state.textContent = validLandmark(id) && memory.has(id) ? ' — visited' : ' — unvisited';
    });
    const progress = map.querySelector<HTMLElement>('[data-map-progress]');
    if (progress) progress.textContent = `${memory.size} / ${landmarks.length} explored`;
  }

  function reveal(id: Landmark, animate = true): void {
    if (memory.has(id)) return;
    memory.add(id);
    try { localStorage.setItem('pixel-map-visited', JSON.stringify([...memory])); } catch { /* Retain this document's in-memory exploration state. */ }
    paint();
    const link = links.find(item => item.dataset.mapLandmark === id);
    if (!link || !animate || !map.open || settings.isReduced()) return;
    link.dataset.revealing = 'true';
    const timer = setTimeout(() => { delete link.dataset.revealing; timers.delete(timer); }, 180);
    timers.add(timer);
  }

  links.forEach(link => link.addEventListener('click', event => {
    if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
  }, { signal }));
  if (location.pathname.startsWith('/projects/')) reveal('projects', false);
  else if (location.pathname === '/') reveal('home', false);
  paint();

  const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const id = entry.target.id;
      if (entry.isIntersecting && entry.intersectionRect.height >= 48 && validLandmark(id)) reveal(id);
    });
  }, { rootMargin: `-${headerHeight}px 0px -15% 0px`, threshold: [0, 0.1, 0.3] });
  landmarks.forEach(id => { const section = document.getElementById(id); if (section) observer.observe(section); });
  const unsubscribe = settings.subscribe(() => {
    if (settings.isReduced()) links.forEach(link => { delete link.dataset.revealing; });
  });
  return () => {
    controller.abort(); observer.disconnect(); toastSize.disconnect(); toastVisibility.disconnect(); unsubscribe();
    timers.forEach(timer => clearTimeout(timer)); timers.clear();
  };
}
