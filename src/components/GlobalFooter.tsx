/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 Pedro Luis de Oliveira Silva. Todos os direitos reservados.
 */

import { Link } from "react-router-dom";

export function GlobalFooter() {
  return (
    <footer className="w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 px-4">
      <div className="max-w-6xl mx-auto text-center space-y-1">
        <p className="text-xs text-muted-foreground">
          © 2025 APE – Apprentice Practice & Enhancement
        </p>
        <p className="text-xs text-muted-foreground">
          Desenvolvido por Pedro Luis de Oliveira Silva. Todos os direitos reservados.
        </p>
        <Link 
          to="/about" 
          className="text-xs text-primary/70 hover:text-primary transition-colors underline-offset-4 hover:underline"
        >
          Sobre / Termos de Uso
        </Link>
      </div>
    </footer>
  );
}
