import { settings } from './engine/settings';
import { profile } from '../site.config';
type Achievement = 'explorer' | 'night' | 'friend';
type Theme = 'day' | 'night';

const sectionIds = ['home', 'projects', 'skills', 'about', 'contact'] as const;
const achievementNames: Record<Achievement, string> = {
  explorer: 'Leave no stone unturned',
  night: 'A different kind of light',
  friend: 'A friendly face',
};
const dialogue = {
  about: `${profile.name} is an illustrative developer profile. ${profile.summary} This little world celebrates clear ideas, accessible details, and a little room for play.`,
  work: 'Useful tools with a spark of personality! Open the project chest to explore Orbit, Fieldnotes, and Pixel Forge. They are original demo concepts, with design decisions and implementation notes in each project journal.',
  contact: 'A new adventure sounds lovely! This is a demo portfolio, and no personal contact address has been supplied. The ordinary Email and CV links are always in the header. Both contain clearly marked demo details until the owner replaces them. This site has no message form or sending service.',
} as const;

const visitedSections = new Set<string>();
let disposeWorld: (() => void) | undefined;

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The world still works when the browser does not allow local storage.
  }
}

function readAchievements(): Set<Achievement> {
  try {
    const saved: unknown = JSON.parse(readStorage('pixel-achievements') ?? '[]');
    if (!Array.isArray(saved)) return new Set();
    return new Set(saved.filter((value): value is Achievement =>
      typeof value === 'string' && Object.hasOwn(achievementNames, value),
    ));
  } catch {
    return new Set();
  }
}

function initializeWorld(): void {
  disposeWorld?.();
  const controller = new AbortController();
  const { signal } = controller;
  const unlocked = readAchievements();
  const dialog = document.querySelector<HTMLDialogElement>('#npc-dialog');
  const toast = document.querySelector<HTMLElement>('#achievement-toast');
  const toastText = document.querySelector<HTMLElement>('#toast-text');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav]')];
  const sections = sectionIds.flatMap((id) => {
    const section = document.getElementById(id);
    return section ? [section] : [];
  });
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let cycleTimer: ReturnType<typeof setTimeout> | undefined;
  let navigationTimer: ReturnType<typeof setTimeout> | undefined;
  let observer: IntersectionObserver | undefined;
  let cycleObserver: IntersectionObserver | undefined;
  let worldVisible = false;
  let opener: HTMLElement | null = null;
  let cycleRemaining = 90_000;
  let cycleStarted = 0;

  function renderAchievements(): void {
    document.querySelectorAll<HTMLElement>('[data-achievement]').forEach((element) => {
      const id = element.dataset.achievement as Achievement;
      const earned = unlocked.has(id);
      element.classList.toggle('unlocked', earned);
      const state = element.querySelector<HTMLElement>('[data-achievement-state]');
      if (state) state.textContent = earned ? 'Unlocked' : 'Locked';
    });
    const count = document.getElementById('achievement-count');
    if (count) count.textContent = `${unlocked.size} / 3 unlocked`;
  }

  function unlock(id: Achievement): void {
    if (unlocked.has(id)) return;
    unlocked.add(id);
    writeStorage('pixel-achievements', JSON.stringify([...unlocked]));
    renderAchievements();
    if (toast && toastText) {
      clearTimeout(toastTimer);
      toastText.textContent = achievementNames[id];
      toast.hidden = false;
      toastTimer = setTimeout(() => { toast.hidden = true; }, 4_000);
    }
  }

  function setTheme(theme: Theme): void {
    document.documentElement.dataset.theme = theme;
    writeStorage('pixel-theme', theme);
    const toggle = document.getElementById('day-toggle');
    toggle?.setAttribute('aria-pressed', String(theme === 'night'));
    toggle?.setAttribute('aria-label', `Switch to ${theme === 'night' ? 'day' : 'night'}`);
    document.querySelectorAll<HTMLElement>('[data-time-label]').forEach((label) => {
      label.textContent = theme === 'night' ? 'Nighttime' : 'Daytime';
    });
  }

  function stopCycle(): void {
    if (cycleTimer !== undefined) {
      cycleRemaining = Math.max(0, cycleRemaining - (Date.now() - cycleStarted));
      clearTimeout(cycleTimer);
      cycleTimer = undefined;
    }
  }

  function scheduleCycle(): void {
    if (document.hidden || !worldVisible || settings.isReduced() || cycleTimer !== undefined) return;
    cycleStarted = Date.now();
    cycleTimer = setTimeout(() => {
      cycleTimer = undefined;
      if (settings.isReduced()) { cycleRemaining = 90_000; return; }
      setTheme(document.documentElement.dataset.theme === 'night' ? 'day' : 'night');
      cycleRemaining = 90_000;
      scheduleCycle();
    }, cycleRemaining);
  }

  setTheme(readStorage('pixel-theme') === 'night' ? 'night' : 'day');
  renderAchievements();
  if (toast) toast.hidden = true;
  const home = document.getElementById('home');
  if (home) {
    cycleObserver = new IntersectionObserver(([entry]) => {
      worldVisible = entry.isIntersecting;
      if (worldVisible) scheduleCycle();
      else stopCycle();
    });
    cycleObserver.observe(home);
  }

  document.getElementById('day-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'night' ? 'day' : 'night';
    setTheme(next);
    if (next === 'night') unlock('night');
    stopCycle();
    cycleRemaining = 90_000;
    scheduleCycle();
  }, { signal });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCycle();
    else scheduleCycle();
  }, { signal });

  reducedMotion.addEventListener('change', () => {
    stopCycle();
    cycleRemaining = 90_000;
    scheduleCycle();
  }, { signal });
  const unsubscribeSettings = settings.subscribe(() => { stopCycle(); cycleRemaining = 90_000; scheduleCycle(); });

  document.querySelectorAll<HTMLElement>('[data-open-dialog]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!dialog || dialog.open) return;
      opener = button;
      dialog.showModal();
      unlock('friend');
    }, { signal });
  });

  document.querySelectorAll<HTMLElement>('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => dialog?.close(), { signal });
  });

  dialog?.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
      event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }, { signal });

  dialog?.addEventListener('close', () => {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }, { signal });

  const topicButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-dialog-topic]')];
  topicButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const topic = button.dataset.dialogTopic as keyof typeof dialogue;
      const message = document.getElementById('npc-message');
      if (!message || !Object.hasOwn(dialogue, topic)) return;
      message.textContent = dialogue[topic];
      topicButtons.forEach((option) => option.setAttribute('aria-pressed', String(option === button)));
    }, { signal });
  });

  const tooltipTriggers = [...document.querySelectorAll<HTMLElement>('[data-tooltip], [data-skill], [data-project], .buff')];
  tooltipTriggers.forEach((trigger) => {
    const restoreTooltip = () => { delete trigger.dataset.tooltipHidden; };
    trigger.addEventListener('pointerleave', restoreTooltip, { signal });
    trigger.addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node) || !trigger.contains(event.relatedTarget)) restoreTooltip();
    }, { signal });
  });

  function updateNavigation(): void {
    navigationTimer = undefined;
    if (!sections.length) return;
    const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
    const line = headerHeight + Math.min(160, window.innerHeight * 0.2);
    let current = sections[0]?.id;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) current = section.id;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
      current = sections.at(-1)?.id ?? current;
    }
    navLinks.forEach((link) => {
      const active = link.dataset.nav === current;
      link.classList.toggle('selected', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function queueNavigationUpdate(): void {
    if (navigationTimer === undefined) navigationTimer = setTimeout(updateNavigation, 16);
  }

  if (sections.length) {
    const headerHeight = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRect.height >= 24) visitedSections.add(entry.target.id);
      });
      if (sectionIds.every((id) => visitedSections.has(id))) unlock('explorer');
      queueNavigationUpdate();
    }, { rootMargin: `-${headerHeight}px 0px 0px 0px`, threshold: [0, 0.1, 0.3, 0.6] });
    sections.forEach((section) => observer?.observe(section));
    updateNavigation();
    window.addEventListener('scroll', queueNavigationUpdate, { signal, passive: true });
    window.addEventListener('resize', queueNavigationUpdate, { signal, passive: true });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !dialog?.open) {
      tooltipTriggers.forEach((trigger) => {
        if (trigger.matches(':hover') || trigger.contains(document.activeElement)) {
          trigger.dataset.tooltipHidden = 'true';
        }
      });
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey || event.repeat || document.querySelector('dialog[open]')) return;
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
    const index = Number(event.key) - 1;
    if (!/^[1-5]$/.test(event.key)) return;
    const link = navLinks[index];
    if (link) {
      event.preventDefault();
      link.click();
    }
  }, { signal });

  disposeWorld = () => {
    controller.abort();
    unsubscribeSettings();
    observer?.disconnect();
    cycleObserver?.disconnect();
    clearTimeout(toastTimer);
    clearTimeout(cycleTimer);
    clearTimeout(navigationTimer);
    if (dialog?.open) dialog.close();
  };
}

document.addEventListener('astro:page-load', initializeWorld);
document.addEventListener('astro:before-swap', () => {
  disposeWorld?.();
  disposeWorld = undefined;
});

// The same module also works if routing is disabled and the page loads normally.
if (document.readyState !== 'loading') initializeWorld();
else document.addEventListener('DOMContentLoaded', initializeWorld, { once: true });
