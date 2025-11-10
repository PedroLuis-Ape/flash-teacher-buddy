import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionWatcher } from "@/components/SessionWatcher";
import { EconomyInitializer } from "@/components/EconomyInitializer";
import { EconomyProvider } from "@/contexts/EconomyContext";
import { GlobalLayout } from "@/components/GlobalLayout";
import { InstallPWA } from "@/components/InstallPWA";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const UserSearch = lazy(() => import("./pages/UserSearch"));
const Folders = lazy(() => import("./pages/Folders"));
const Folder = lazy(() => import("./pages/Folder"));
const ListDetail = lazy(() => import("./pages/ListDetail"));
const Collection = lazy(() => import("./pages/Collection"));
const PublicCollection = lazy(() => import("./pages/PublicCollection"));
const PublicPortal = lazy(() => import("./pages/PublicPortal"));
const GamesHub = lazy(() => import("./pages/GamesHub"));
const Study = lazy(() => import("./pages/Study"));
const Search = lazy(() => import("./pages/Search"));
const MyStudents = lazy(() => import("./pages/MyStudents"));
const MyTeachers = lazy(() => import("./pages/MyTeachers"));
const TeacherFolders = lazy(() => import("./pages/TeacherFolders"));
const Store = lazy(() => import("./pages/Store"));
const PresentBox = lazy(() => import("./pages/PresentBox"));
const Reinos = lazy(() => import("./pages/Reinos"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <EconomyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={<div className="p-8 text-muted-foreground">Carregando…</div>}>
          <BrowserRouter>
            <SessionWatcher />
            <EconomyInitializer />
            <GlobalLayout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/perfil/:id" element={<PublicProfile />} />
                <Route path="/pesquisar" element={<UserSearch />} />
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
                <Route path="/my-students" element={<MyStudents />} />
                <Route path="/my-teachers" element={<MyTeachers />} />
                <Route path="/teacher/:teacherId/folders" element={<TeacherFolders />} />
                <Route path="/store" element={<Store />} />
                <Route path="/gifts" element={<PresentBox />} />
                <Route path="/reinos" element={<Reinos />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </GlobalLayout>
            <InstallPWA />
          </BrowserRouter>
        </Suspense>
      </TooltipProvider>
    </EconomyProvider>
  </QueryClientProvider>
);

export default App;
