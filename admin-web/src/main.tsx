// admin-web/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const RETURN_TO_KEY = "admin-web:returnToHash";

function normalizeHashUrl() {
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  const basePath = baseUrl.replace(/\/$/, ""); // "/admin/" -> "/admin", "/" -> ""
  const rootPath = basePath === "" ? "/" : `${basePath}/`;

  const { pathname, search, hash } = window.location;

  const saveReturnTo = (h: string) => {
    try {
      if (h.startsWith("#/") && h !== "#/") {
        window.sessionStorage.setItem(RETURN_TO_KEY, h);
      } else {
        window.sessionStorage.removeItem(RETURN_TO_KEY);
      }
    } catch {
      // ignore
    }
  };

  // すでに "#/..." 形式ならOK（ただし pathname が変でも root に寄せる）
  if (hash.startsWith("#/")) {
    saveReturnTo(hash);
    if (pathname !== rootPath && pathname !== basePath) {
      history.replaceState(null, "", `${rootPath}${search}${hash}`);
    }
    return;
  }

  // 変換対象の「ルート（#/以降）」を決める
  let routePath = "/";

  if (hash.startsWith("#") && hash.length > 1) {
    // "#diagnostics" などを "#/diagnostics" に寄せる
    const raw = hash.slice(1);
    routePath = raw.startsWith("/") ? raw : `/${raw}`;
  } else {
    // hash が無い場合は pathname を hash に移す（/diagnostics -> #/diagnostics）
    let rel = pathname;
    if (basePath && rel.startsWith(basePath)) rel = rel.slice(basePath.length);
    if (rel === "" || rel === "/") rel = "/";
    if (!rel.startsWith("/")) rel = `/${rel}`;
    routePath = rel;
  }

  const newHash = `#${routePath}`;
  saveReturnTo(newHash);

  // 履歴は増やさずに、必ず "{root}#/{route}" 形式へ
  history.replaceState(null, "", `${rootPath}${search}${newHash}`);
}

normalizeHashUrl();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);