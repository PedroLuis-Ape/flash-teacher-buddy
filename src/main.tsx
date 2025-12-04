import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/versionManager"; // Verificar versão e limpar cache
import "./i18n/config"; // i18n initialization

createRoot(document.getElementById("root")!).render(<App />);
