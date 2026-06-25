/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 APE Education. Todos os direitos reservados.
 */

import { lazy, useEffect } from "react";
import { perfTelemetry } from "@/lib/perfTelemetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { SessionWatcher } from "@/components/SessionWatcher";
import { PerformanceProvider } from "@/contexts/PerformanceContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalLayout } from "@/components/layout/GlobalLayout";
import { LazyErrorBoundary } from "@/components/LazyErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { RouteSuspense } from "@/components/RouteSuspense";
import { ListDirectionGate } from "@/features/study/components/ListDirectionGate";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
import LandingPage from "./pages/LandingPage";
import RootEntry from "./components/RootEntry";
const InglesParaIniciantes = lazy(() => import("./pages/seo/InglesParaIniciantes"));
const AtividadesDeIngles = lazy(() => import("./pages/seo/AtividadesDeIngles"));
const FlashcardsDeIngles = lazy(() => import("./pages/seo/FlashcardsDeIngles"));
const ParaProfessores = lazy(() => import("./pages/seo/ParaProfessores"));
const Profile = lazy(() => import("./pages/Profile"));
const Folders = lazy(() => import("./pages/Folders"));
const Folder = lazy(() => import("./pages/Folder"));
const FolderWithExport = lazy(() => import("./pages/FolderWithExport"));
const ListDetail = lazy(() => import("./pages/ListDetail"));
const Collection = lazy(() => import("./pages/Collection"));
const PublicCollection = lazy(() => import("./pages/PublicCollection"));
const PublicPortal = lazy(() => import("./pages/PublicPortal"));
const PublicTeacherProfile = lazy(() => import("./pages/PublicTeacherProfile"));
const PublicProfileSettings = lazy(() => import("./pages/PublicProfileSettings"));
const GamesHub = lazy(() => import("./pages/GamesHub"));
const PublicClassGamesHub = lazy(() => import("./pages/PublicClassGamesHub"));
const Study = lazy(() => import("./pages/Study"));
const MixedStudy = lazy(() => import("./pages/MixedStudy"));
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
const SuperGlobalImport = lazy(() => import("./pages/SuperGlobalImport"));
const Trash = lazy(() => import("./pages/Trash"));
const PerformanceSettings = lazy(() => import("./pages/PerformanceSettings"));
const AuditRepair = lazy(() => import("./pages/AuditRepair"));
const KeyboardShortcutsPage = lazy(() => import("./pages/KeyboardShortcuts"));
const SpecialCards = lazy(() => import("./pages/SpecialCards"));
const SystemStatus = lazy(() => import("./pages/SystemStatus"));
const Glossary = lazy(() => import("./pages/Glossary"));
const BugReport = lazy(() => import("./pages/BugReport"));

function PublicListGamesRoute() {
  const [searchParams] = useSearchParams();
  const classroomMode =
    searchParams.get("guest") === "true" &&
    Boolean(searchParams.get("turma")) &&
    Boolean(searchParams.get("atribuicao"));

  if (classroomMode) return <PublicClassGamesHub />;

  return (
    <ListDirectionGate>
      <GamesHub />
    </ListDirectionGate>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      onError: (error) => {
        console.warn('[QueryClient] Mutation error (handled globally):', error);
      },
    },
  },
});

queryClient.getQueryCache().config.onError = (error, query) => {
  console.warn('[QueryClient] Query failed:', query.queryKey, error);
};

const App = () => {
  useEffect(() => { perfTelemetry.logBoot(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <PerformanceProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <LazyErrorBoundary>
              <BrowserRouter>
                <SessionWatcher />
                <GlobalLayout>
                  <RouteErrorBoundary>
                    <RouteSuspense>
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
                          <Route path="/glossary" element={<Glossary />} />
                          <Route path="/search" element={<Search />} />
                          <Route path="/folder/:id" element={<FolderWithExport />} />
                          <Route path="/list/:id" element={<ListDetail />} />
                          <Route path="/list/:id/games" element={<ListDirectionGate><GamesHub /></ListDirectionGate>} />
                          <Route path="/list/:id/study" element={<ListDirectionGate><Study /></ListDirectionGate>} />
                          <Route path="/list/:id/mixed-study" element={<ListDirectionGate><MixedStudy /></ListDirectionGate>} />
                          <Route path="/collection/:id" element={<Collection />} />
                          <Route path="/collection/:id/games" element={<GamesHub />} />
                          <Route path="/collection/:id/study" element={<Study />} />
                          <Route path="/collection/:id/mixed-study" element={<MixedStudy />} />
                          <Route path="/portal" element={<PublicPortal />} />
                          <Route path="/portal/professor/:slug" element={<PublicTeacherProfile />} />
                          <Route path="/portal/folder/:id" element={<Folder />} />
                          <Route path="/portal/list/:id/games" element={<PublicListGamesRoute />} />
                          <Route path="/portal/list/:id/study" element={<ListDirectionGate><Study /></ListDirectionGate>} />
                          <Route path="/portal/list/:id/mixed-study" element={<ListDirectionGate><MixedStudy /></ListDirectionGate>} />
                          <Route path="/portal/collection/:id" element={<PublicCollection />} />
                          <Route path="/portal/collection/:id/study" element={<Study />} />
                          <Route path="/portal/collection/:id/mixed-study" element={<MixedStudy />} />
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
                          <Route path="/turmas/:turmaId/import/super" element={<SuperGlobalImport />} />
                          <Route path="/professor/alunos" element={<MeusAlunos />} />
                          <Route path="/professor/alunos/:alunoId" element={<AlunoProfile />} />
                          <Route path="/professores/:professorId" element={<ProfessorProfile />} />
                          <Route path="/my-teachers" element={<MyTeachers />} />
                          <Route path="/painel-professor" element={<PainelProfessor />} />
                          <Route path="/settings/public-profile" element={<PublicProfileSettings />} />
                          <Route path="/about" element={<About />} />
                          <Route path="/notes" element={<Notes />} />
                          <Route path="/notes/:id" element={<NoteEditor />} />
                          <Route path="/goals" element={<Goals />} />
                          <Route path="/goals/new" element={<GoalNew />} />
                          <Route path="/import" element={<GlobalImport />} />
                          <Route path="/import/super" element={<SuperGlobalImport />} />
                          <Route path="/trash" element={<Trash />} />
                          <Route path="/settings/performance" element={<PerformanceSettings />} />
                          <Route path="/settings/shortcuts" element={<KeyboardShortcutsPage />} />
                          <Route path="/audit" element={<AuditRepair />} />
                          <Route path="/special-cards" element={<SpecialCards />} />
                          <Route path="/system-status" element={<SystemStatus />} />
                          <Route path="/reportar-problema" element={<BugReport />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </PageTransition>
                    </RouteSuspense>
                  </RouteErrorBoundary>
                </GlobalLayout>
              </BrowserRouter>
            </LazyErrorBoundary>
          </TooltipProvider>
        </AuthProvider>
      </PerformanceProvider>
    </QueryClientProvider>
  );
};

export default App;
