// Замена next/navigation для веб-версии: маршрутизация в памяти страницы.
import { useMemo, useSyncExternalStore } from "react";

type Route = { path: string; search: string };
let route: Route = { path: "/", search: "" };
const subs = new Set<() => void>();

export function setRoute(url: string) {
  const [path, search = ""] = url.split("?");
  route = { path: path || "/", search };
  subs.forEach((s) => s());
  try {
    window.scrollTo({ top: 0 });
  } catch {
    /* ignore */
  }
}

const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
};

export function useRoute() {
  return useSyncExternalStore(subscribe, () => route, () => route);
}

export function useRouter() {
  return { push: setRoute, replace: setRoute, back() {}, forward() {}, refresh() {}, prefetch() {} };
}

export function useSearchParams() {
  const r = useRoute();
  return useMemo(() => new URLSearchParams(r.search), [r.search]);
}

export function usePathname() {
  return useRoute().path;
}
