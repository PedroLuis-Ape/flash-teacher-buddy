/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 Pedro Luis de Oliveira Silva. Todos os direitos reservados.
 * Este software é de uso exclusivo do autor e de seus alunos autorizados.
 * É proibida a cópia, redistribuição ou utilização comercial sem autorização por escrito.
 */

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/versionManager"; // Verificar versão e limpar cache
import "./lib/errorCapture"; // Global error/rejection capture (must be early)
import "./i18n/config"; // i18n initialization
import { SafeMode } from "./components/SafeMode";

createRoot(document.getElementById("root")!).render(
  <SafeMode>
    <App />
  </SafeMode>
);
