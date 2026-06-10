/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 APE Education. Todos os direitos reservados.
 */

import { lazy, Suspense, useEffect } from "react";
import { perfTelemetry } from "@/lib/perfTelemetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionWatcher } from "@/components/SessionWatcher";
import { EconomyInitializer } from "@/components/EconomyInitializer";
import { EconomyProvider } from "@/contexts/EconomyContext";
import { PerformanceProvider } from "@/contexts/PerformanceContext";
import { GlobalLayout } from "@/components/layout/GlobalLayout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { LazyErrorBoundary } from "@/components/LazyErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import { BrowserCheck } from "@/components/BrowserCheck";
import { GoogleConnectPrompt } from "@/features/auth/components/GoogleConnectPrompt";

const Index = lazy(() => import("./pages/Index"));
import Auth from "./pages/Auth"; // Eagerly loaded — critical first paint for unauthenticated users
import LandingPage from "./pages/LandingPage"; // Public landing — eager so SEO/visitor first paint is instant
import RootEntry from "./components/RootEntry"; // Smart "/" gate: guests → landing, logged-in → /dashboard
const InglesParaIniciantes = lazy(() => import("./pages/seo/InglesParaIniciantes"));
const AtividadesDeIngles = lazy(() => import("./pages/seo/AtividadesDeIngles"));
const FlashcardsDeIngles = lazy(() => import("./pages/seo/FlashcardsDeIngles"));
const ParaProfessores = lazy(() => import("./pages/seo/ParaProfessores"));
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
const Notes = lazy(() => import("./pages/Notes"));
const NoteEditor = lazy(() => import("./pages/NoteEditor"));
const Goals = lazy(() => import("./pages/Goals"));
const GoalNew = lazy(() => import("./pages/GoalNew"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const GlobalImport = lazy(() => import("./pages/GlobalImport"));
const Trash = lazy(() => import("./pages/Trash"));
const PerformanceSettings = lazy(() => import("./pages/PerformanceSettings"));
const AuditRepair = lazy(() => import("./pages/AuditRepair"));
const KeyboardShortcutsPage = lazy(() => import("./pages/KeyboardShortcuts"));
const SpecialCards = lazy(() => import("./pages/SpecialCards"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      // Global mutation error handler — prevent unhandled rejections from mutations
      onError: (error) => {
        console.warn('[QueryClient] Mutation error (handled globally):', error);
      },
    },
  },
});

// Global query cache error handler — logs failed queries so they don't become
// unhandled rejections that poison the app
queryClient.getQueryCache().config.onError = (error, query) => {
  console.warn('[QueryClient] Query failed:', query.queryKey, error);
};

const App = () => {
  useEffect(() => { perfTelemetry.logBoot(); }, []);
  return (
  <QueryClientProvider client={queryClient}>
    <PerformanceProvider>
    <EconomyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={<LoadingSpinner message="Carregando página..." variant="skeleton" />}>
        <LazyErrorBoundary>
          <BrowserRouter>
            <SessionWatcher />
            <EconomyInitializer />
            <BrowserCheck />
            <GoogleConnectPrompt />
            <GlobalLayout>
              <PageTransition>
                <Routes>
                  <Route path="/" element={<RootEntry />} />
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/ingles-para-iniciantes" element={<InglesParaIniciantes />} />
                  <Route path="/atividades-de-ingles" element={<AtividadesDeIngles />} />
                  <Route path="/flashcards-de-ingles" element={<FlashcardsDeIngles />} />
                  <Route path="/para-professores" element={<ParaProfessores />} />
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
                  <Route path="/notes" element={<Notes />} />
                  <Route path="/notes/:id" element={<NoteEditor />} />
                  <Route path="/goals" element={<Goals />} />
                  <Route path="/goals/new" element={<GoalNew />} />
                  <Route path="/import" element={<GlobalImport />} />
                  <Route path="/trash" element={<Trash />} />
                  <Route path="/settings/performance" element={<PerformanceSettings />} />
                  <Route path="/settings/shortcuts" element={<KeyboardShortcutsPage />} />
                  <Route path="/audit" element={<AuditRepair />} />
                  <Route path="/special-cards" element={<SpecialCards />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </PageTransition>
            </GlobalLayout>
          </BrowserRouter>
        </LazyErrorBoundary>
        </Suspense>
      </TooltipProvider>
    </EconomyProvider>
    </PerformanceProvider>
  </QueryClientProvider>
  );
};

export default App;
