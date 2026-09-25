import { createRoot } from "react-dom/client";
import { installApiShim } from "./api";
import { setRoute, useRoute } from "./shims/next-navigation";
import { StoreProvider } from "@/lib/store";
import { Toaster } from "@/components/toast";
import Landing from "@/app/page";
import Dashboard from "@/app/dashboard/page";

installApiShim();

// Если профиль уже настроен — сразу в дашборд
try {
  const saved = JSON.parse(localStorage.getItem("viralpilot:v1") ?? "null");
  if (saved?.account && saved?.settings) setRoute("/dashboard");
} catch {
  /* хранилище недоступно — начинаем с главной */
}

function App() {
  const r = useRoute();
  return r.path.startsWith("/dashboard") ? <Dashboard /> : <Landing />;
}

createRoot(document.getElementById("root")!).render(
  <StoreProvider>
    <App />
    <Toaster />
  </StoreProvider>,
);
