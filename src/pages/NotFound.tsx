import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { SEOHead } from "@/components/seo/SEOHead";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.error("404: rota inexistente:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <>
      <SEOHead
        title="Página não encontrada | APE"
        description="A página solicitada não existe ou não está disponível. Volte para a página inicial do App Piteco."
        path={location.pathname}
        canonicalPath={null}
        robots="noindex,nofollow,noarchive"
      />

      <main className="flex min-h-screen items-center justify-center bg-muted px-6">
        <div className="max-w-md text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
            Erro 404
          </p>
          <h1 className="mb-4 text-4xl font-bold">Página não encontrada</h1>
          <p className="mb-6 text-lg text-muted-foreground">
            O endereço acessado não existe ou pode ter sido alterado.
          </p>
          <Link
            to="/"
            className="inline-flex rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Voltar para o início
          </Link>
        </div>
      </main>
    </>
  );
};

export default NotFound;
