import type { TransitionBeforeSwapEvent, TransitionBeforePreparationEvent } from 'astro:transitions/client';
import { mountContent } from './content';

type View = 'classic' | 'game';
let cleanup: (() => void) | undefined;
let noticeShown = false;
const view = (): View => document.documentElement.dataset.mode === 'classic' ? 'classic' : 'game';
function save(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* Preferences are optional. */ } }

function mount(): void {
  cleanup?.();
  const disposeContent = mountContent();
  const controller = new AbortController();
  const { signal } = controller;
  const mode = view();
  document.querySelectorAll<HTMLElement>('[data-shortcut]').forEach(link => {
    const label = link.querySelector('.slot-label')?.textContent?.trim() ?? '';
    link.setAttribute('aria-label', mode === 'game' ? `${label} — shortcut ${link.dataset.shortcut}` : label);
    if (mode === 'game') link.setAttribute('aria-keyshortcuts', link.dataset.shortcut!);
    else link.removeAttribute('aria-keyshortcuts');
  });
  const header = document.querySelector('header');
  const measureHeader = () => {
    document.documentElement.style.setProperty('--header-height', `${Math.ceil(header?.getBoundingClientRect().height ?? 0)}px`);
    document.documentElement.style.setProperty('--hotbar-height', `${Math.ceil(document.querySelector('.hotbar')?.getBoundingClientRect().height ?? 48)}px`);
  };
  const headerSize = new ResizeObserver(measureHeader);
  if (header) headerSize.observe(header);
  measureHeader();
  document.querySelectorAll<HTMLAnchorElement>('[data-view-link]').forEach(link => {
    const next = link.dataset.viewLink === 'toggle' ? (mode === 'game' ? 'classic' : 'game') : 'classic';
    const url = new URL(location.href);
    url.searchParams.set('mode', next);
    link.href = url.pathname + url.search + url.hash;
    if (link.dataset.viewLink === 'toggle') link.textContent = `${next === 'classic' ? 'Classic' : 'Game'} view`;
    link.addEventListener('click', () => save('pixel-view', next), { signal });
  });
  const notice = document.querySelector<HTMLElement>('[data-view-notice]');
  if (notice) {
    const classicLandscape = mode === 'classic' && document.documentElement.dataset.landscape === 'true';
    notice.hidden = (mode === 'classic' && !classicLandscape) || (notice.dataset.shown !== 'true' && (noticeShown || document.documentElement.dataset.noticeState !== 'show'));
    if (!notice.hidden) { notice.dataset.shown = 'true'; noticeShown = true; save('pixel-view-notice', 'seen'); }
    notice.querySelector('button')?.addEventListener('click', () => { notice.hidden = true; }, { signal });
  }
  if (mode === 'game') void import('./game');
  else {
    const toggle = document.getElementById('day-toggle');
    const paintTheme = () => {
      const night = document.documentElement.dataset.theme === 'night';
      toggle?.setAttribute('aria-pressed', String(night));
      toggle?.setAttribute('aria-label', `${night ? 'Nighttime' : 'Daytime'} — Switch to ${night ? 'day' : 'night'}`);
      document.querySelectorAll('[data-time-label]').forEach(label => { label.textContent = night ? 'Nighttime' : 'Daytime'; });
    };
    paintTheme();
    toggle?.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'night' ? 'day' : 'night';
      document.documentElement.dataset.theme = theme;
      save('pixel-theme', theme);
      paintTheme();
    }, { signal });
    const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav]')];
    const sections = links.map(link => document.getElementById(link.dataset.nav!)).filter((item): item is HTMLElement => !!item);
    const update = () => {
      const line = (document.querySelector('header')?.getBoundingClientRect().height ?? 0) + 100;
      let active = sections[0]?.id;
      for (const section of sections) if (section.getBoundingClientRect().top <= line) active = section.id;
      links.forEach(link => {
        link.classList.toggle('selected', link.dataset.nav === active);
        if (link.dataset.nav === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    update();
    window.addEventListener('scroll', update, { signal, passive: true });
    window.addEventListener('resize', update, { signal, passive: true });
  }
  cleanup = () => { controller.abort(); headerSize.disconnect(); disposeContent(); };
}

const shortLandscape = window.matchMedia('(pointer: coarse) and (orientation: landscape) and (max-height: 500px)');
shortLandscape.addEventListener('change', event => {
  const forced = new URLSearchParams(location.search).get('mode');
  if (!event.matches || forced === 'game' || forced === 'classic') return;
  // A fresh document releases Game modules and graphics resources completely.
  if (view() === 'game') { location.reload(); return; }
  document.documentElement.dataset.landscape = 'true';
  document.documentElement.dataset.noticeState = 'show';
  const notice = document.querySelector<HTMLElement>('[data-view-notice]');
  if (notice) { notice.hidden = false; notice.dataset.shown = 'true'; }
});

// A mode change always gets a fresh document, so Game resources cannot survive it.
document.addEventListener('astro:before-preparation', event => {
  const navigation = event as TransitionBeforePreparationEvent;
  const mode = navigation.to.searchParams.get('mode');
  if ((mode === 'classic' || mode === 'game') && mode !== view()) {
    event.preventDefault();
    location.assign(navigation.to);
  }
});
document.addEventListener('astro:before-swap', event => {
  cleanup?.();
  const next = (event as TransitionBeforeSwapEvent).newDocument.documentElement;
  next.dataset.mode = view();
  next.dataset.theme = document.documentElement.dataset.theme ?? 'day';
});
document.addEventListener('astro:after-swap', () => {
  if (view() !== 'classic') return;
  const heading = document.querySelector<HTMLElement>('main h1');
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
});
document.addEventListener('astro:page-load', mount);
mount();
