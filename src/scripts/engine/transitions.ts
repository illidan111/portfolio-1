import type { TransitionBeforeSwapEvent } from 'astro:transitions/client';
import { features } from '../../site.config';
import { settings } from './settings';

let dispose: (() => void) | undefined;

/** Installs once for the ClientRouter lifetime, rather than once per swapped page. */
export function mountTransitions(): () => void {
  if (dispose) return dispose;
  if (!features.transitions) return () => {};
  const controller = new AbortController();
  const { signal } = controller;
  let generation = 0;
  let native = false;
  let animate = false;
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;

  function clearVisuals(): void {
    delete document.documentElement.dataset.digCapture;
    delete document.documentElement.dataset.digFallback;
    delete document.documentElement.dataset.digNative;
  }

  document.addEventListener('astro:before-swap', (event) => {
    const transition = event as TransitionBeforeSwapEvent;
    generation++;
    const current = generation;
    clearTimeout(cleanupTimer);
    clearVisuals();
    animate = !settings.isReduced();
    native = typeof document.startViewTransition === 'function';
    transition.newDocument.documentElement.dataset.motion = animate ? 'full' : 'reduced';
    transition.newDocument.documentElement.dataset.theme = document.documentElement.dataset.theme ?? 'day';
    transition.newDocument.documentElement.dataset.quality = settings.quality();
    if (!animate) {
      // Native ViewTransition.ready intentionally rejects when a transition is skipped.
      void transition.viewTransition.ready.catch(() => {});
      transition.viewTransition.skipTransition();
      return;
    }
    document.dispatchEvent(new CustomEvent('pixel:sound', { detail: 'page-dig' }));
    if (!native) return;
    // Keep the named source rendered until completion: hiding it at ready cancels
    // the browser's live incoming snapshot and prematurely ends the transition.
    transition.newDocument.documentElement.dataset.digCapture = 'true';
    transition.newDocument.documentElement.dataset.digNative = 'true';
    void transition.viewTransition.ready.catch(() => { if (current === generation) clearVisuals(); });
    void transition.viewTransition.finished.then(() => {
      if (current === generation) clearVisuals();
    }, () => { if (current === generation) clearVisuals(); });
  }, { signal });

  document.addEventListener('astro:after-swap', () => {
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
    const announcement = document.querySelector<HTMLElement>('[data-page-announcement]');
    if (announcement) announcement.textContent = document.title;
    if (animate && !native && !settings.isReduced()) {
      document.documentElement.dataset.digFallback = 'true';
      cleanupTimer = setTimeout(clearVisuals, 520);
    }
  }, { signal });

  const unsubscribe = settings.subscribe(() => {
    if (settings.isReduced()) { animate = false; clearVisuals(); }
  });
  dispose = () => {
    controller.abort(); unsubscribe(); clearTimeout(cleanupTimer); clearVisuals(); dispose = undefined;
  };
  return dispose;
}
