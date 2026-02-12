/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 Pedro Luis de Oliveira Silva. Todos os direitos reservados.
 */

import { Link } from "react-router-dom";

export function GlobalFooter() {
  return (
    <footer className="w-full py-3 px-4 mt-auto">
      <div className="max-w-6xl mx-auto">
        {/* Desktop: single line */}
        <div className="hidden sm:flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/60">
          <span>© 2025 APE – Apprentice Practice & Enhancement</span>
          <span className="text-muted-foreground/30">•</span>
          <span>Por Pedro Luis de Oliveira Silva</span>
          <span className="text-muted-foreground/30">•</span>
          <Link 
            to="/about" 
            className="text-primary/50 hover:text-primary transition-colors duration-200"
          >
            Termos
          </Link>
        </div>
        
        {/* Mobile: two lines */}
        <div className="flex sm:hidden flex-col items-center gap-0.5 text-[10px] text-muted-foreground/60">
          <span>© 2025 APE • Por Pedro Luis de Oliveira Silva</span>
          <Link 
            to="/about" 
            className="text-primary/50 hover:text-primary transition-colors duration-200"
          >
            Termos de Uso
          </Link>
        </div>
      </div>
    </footer>
  );
}
