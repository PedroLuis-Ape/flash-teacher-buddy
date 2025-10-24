import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionWatcher } from "@/components/SessionWatcher";

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
const MyStudents = lazy(() => import("./pages/MyStudents"));
const MyTeachers = lazy(() => import("./pages/MyTeachers"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Carregando…</div>}>
        <BrowserRouter>
          <SessionWatcher />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
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
            <Route path="/my-students" element={<MyStudents />} />
            <Route path="/my-teachers" element={<MyTeachers />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </Suspense>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
