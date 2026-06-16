import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthUser } from '@/hooks/useAuthUser';
import {
  consumeGuestResume,
  getGuestHistory,
  recordGuestHistory,
  updateGuestHistoryPosition,
  type GuestHistoryItemType,
} from '@/lib/guestHistory';

function inferType(pathname: string): GuestHistoryItemType | null {
  if (/^\/portal\/professor\//.test(pathname)) return 'teacher';
  if (/^\/portal\/folder\//.test(pathname)) return 'folder';
  if (/\/study$/.test(pathname)) return 'study';
  if (/\/games$/.test(pathname)) return 'activity';
  if (/^\/portal\/(list|collection)\//.test(pathname)) return 'list';
  return null;
}

function fallbackTitle(type: GuestHistoryItemType) {
  switch (type) {
    case 'teacher': return 'Perfil de professor';
    case 'folder': return 'Pasta pública';
    case 'study': return 'Sessão de estudo';
    case 'activity': return 'Atividade pública';
    default: return 'Material público';
  }
}

function cleanDocumentTitle(type: GuestHistoryItemType) {
  const raw = document.title.trim();
  if (!raw) return fallbackTitle(type);
  return raw
    .replace(/\s*[|—-]\s*APE(?: Education)?(?:\s.*)?$/i, '')
    .trim()
    .slice(0, 120) || fallbackTitle(type);
}

function readProgressLabel() {
  const progress = document.querySelector<HTMLElement>('[role="progressbar"]');
  const now = progress?.getAttribute('aria-valuenow');
  if (!now) return undefined;
  const numeric = Number(now);
  if (!Number.isFinite(numeric)) return undefined;
  return `${Math.round(numeric)}% concluído`;
}

export function GuestHistoryTracker() {
  const location = useLocation();
  const { isLoading } = useAuthUser();
  const path = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (isLoading || location.pathname === '/portal') return;
    const type = inferType(location.pathname);
    if (!type) return;

    const pathParts = location.pathname.split('/').filter(Boolean);
    const entityId = pathParts[pathParts.length - 1];

    const recordCurrentPage = () => {
      recordGuestHistory({
        type,
        path,
        title: cleanDocumentTitle(type),
        entityId,
        scrollY: window.scrollY,
        progressLabel: readProgressLabel(),
      });
    };

    const timer = window.setTimeout(() => {
      recordCurrentPage();

      if (consumeGuestResume(path)) {
        const saved = getGuestHistory().find((item) => item.path === path);
        if (saved?.scrollY) {
          window.requestAnimationFrame(() => {
            window.setTimeout(() => window.scrollTo({ top: saved.scrollY, behavior: 'smooth' }), 120);
          });
        }
      }
    }, 450);

    const titleNode = document.querySelector('title');
    const titleObserver = titleNode
      ? new MutationObserver(() => recordCurrentPage())
      : null;
    titleObserver?.observe(titleNode as Node, { childList: true, subtree: true, characterData: true });

    let scrollTimer: number | undefined;
    const savePosition = () => {
      if (scrollTimer) window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        updateGuestHistoryPosition(path, window.scrollY, readProgressLabel());
      }, 350);
    };

    window.addEventListener('scroll', savePosition, { passive: true });
    return () => {
      window.clearTimeout(timer);
      if (scrollTimer) window.clearTimeout(scrollTimer);
      titleObserver?.disconnect();
      window.removeEventListener('scroll', savePosition);
      updateGuestHistoryPosition(path, window.scrollY, readProgressLabel());
    };
  }, [isLoading, location.pathname, path]);

  return null;
}
