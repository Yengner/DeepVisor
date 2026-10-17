import { useSyncExternalStore } from 'react';
const subscribe = (callback: () => void) => {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
};
export function useSearchParams() {
  return new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search, () => ''));
}
export function usePathname() { return '/reports'; }
export function useRouter() {
  return {
    replace: (url: string) => {
      window.history.replaceState(null, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    },
    refresh: () => { document.documentElement.dataset.reportReloads = String(Number(document.documentElement.dataset.reportReloads ?? 0) + 1); },
  };
}
