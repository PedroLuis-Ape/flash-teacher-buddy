/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 Pedro Luis de Oliveira Silva. Todos os direitos reservados.
 * Este software é de uso exclusivo do autor e de seus alunos autorizados.
 * É proibida a cópia, redistribuição ou utilização comercial sem autorização por escrito.
 */

import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionWatcher } from "@/components/SessionWatcher";
import { EconomyInitializer } from "@/components/EconomyInitializer";
import { EconomyProvider } from "@/contexts/EconomyContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { GlobalLayout } from "@/components/GlobalLayout";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { InstallPWA } from "@/components/InstallPWA";
import { PageTransition } from "@/components/PageTransition";
import { BrowserCheck } from "@/components/BrowserCheck";
import { GoogleConnectPrompt } from "@/components/GoogleConnectPrompt";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const Folders = lazy(() => import("./pages/Folders"));
const Folder = lazy(() => import("./pages/Folder"));
const ListDetail = lazy(() => import("./pages/ListDetail"));
const Collection = lazy(() => import("./pages/Collection"));
const PublicCollection = lazy(() => import("./pages/PublicCollection"));
const PublicPortal = lazy(() => import("./pages/PublicPortal"));
const GamesHub = lazy(() => import("./pages/GamesHub"));
const Study = lazy(() => import("./pages/Study"));
const Search = lazy(() => import("./pages/Search"));
const Store = lazy(() => import("./pages/Store"));
const PresentBox = lazy(() => import("./pages/PresentBox"));
const Reinos = lazy(() => import("./pages/Reinos"));
const KingdomDetail = lazy(() => import("./pages/KingdomDetail"));
const KingdomImport = lazy(() => import("./pages/KingdomImport"));
const AdminCatalog = lazy(() => import("./pages/admin/AdminCatalog"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminGifts = lazy(() => import("./pages/admin/AdminGifts"));
const Turmas = lazy(() => import("./pages/Turmas"));
const TurmaDetail = lazy(() => import("./pages/TurmaDetail"));
const TurmasProfessor = lazy(() => import("./pages/TurmasProfessor"));
const TurmasAluno = lazy(() => import("./pages/TurmasAluno"));
const MeusAlunos = lazy(() => import("./pages/MeusAlunos"));
const AlunoProfile = lazy(() => import("./pages/AlunoProfile"));
const ProfessorProfile = lazy(() => import("./pages/ProfessorProfile"));
const MyTeachers = lazy(() => import("./pages/MyTeachers"));
const PainelProfessor = lazy(() => import("./pages/PainelProfessor"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LoadingProvider>
      <EconomyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LoadingOverlay />
          <Suspense fallback={<LoadingSpinner message="Carregando página..." variant="skeleton" />}>
            <BrowserRouter>
              <SessionWatcher />
              <EconomyInitializer />
              <BrowserCheck />
              <GoogleConnectPrompt />
              <GlobalLayout>
              <PageTransition>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/folders" element={<Folders />} />
                <Route path="/search" element={<Search />} />
                <Route path="/folder/:id" element={<Folder />} />
                <Route path="/list/:id" element={<ListDetail />} />
                <Route path="/list/:id/games" element={<GamesHub />} />
                <Route path="/list/:id/study" element={<Study />} />
                <Route path="/collection/:id" element={<Collection />} />
                <Route path="/collection/:id/games" element={<GamesHub />} />
                <Route path="/collection/:id/study" element={<Study />} />
                <Route path="/portal" element={<PublicPortal />} />
                <Route path="/portal/folder/:id" element={<Folder />} />
                <Route path="/portal/list/:id/games" element={<GamesHub />} />
                <Route path="/portal/list/:id/study" element={<Study />} />
                <Route path="/portal/collection/:id" element={<PublicCollection />} />
                <Route path="/portal/collection/:id/study" element={<Study />} />
                <Route path="/store" element={<Store />} />
                <Route path="/gifts" element={<PresentBox />} />
                <Route path="/reinos" element={<Reinos />} />
                <Route path="/reino" element={<Reinos />} />
                <Route path="/reino/:code" element={<KingdomDetail />} />
                <Route path="/store/inventory" element={<Store />} />
                <Route path="/store/exchange" element={<Store />} />
                <Route path="/reino/importar" element={<KingdomImport />} />
                <Route path="/admin/catalog" element={<AdminCatalog />} />
                <Route path="/admin/logs" element={<AdminLogs />} />
                <Route path="/admin/gifts" element={<AdminGifts />} />
                <Route path="/turmas" element={<Turmas />} />
                <Route path="/turmas/professor" element={<TurmasProfessor />} />
                <Route path="/turmas/aluno" element={<TurmasAluno />} />
                <Route path="/turmas/:turmaId" element={<TurmaDetail />} />
                <Route path="/professor/alunos" element={<MeusAlunos />} />
                <Route path="/professor/alunos/:alunoId" element={<AlunoProfile />} />
                <Route path="/professores/:professorId" element={<ProfessorProfile />} />
                <Route path="/my-teachers" element={<MyTeachers />} />
                <Route path="/painel-professor" element={<PainelProfessor />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </PageTransition>
            </GlobalLayout>
            <InstallPWA />
          </BrowserRouter>
        </Suspense>
      </TooltipProvider>
    </EconomyProvider>
  </LoadingProvider>
  </QueryClientProvider>
);

export default App;
