import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Folders from "./pages/Folders";
import Folder from "./pages/Folder";
import ListDetail from "./pages/ListDetail";
import Collection from "./pages/Collection";
import GamesHub from "./pages/GamesHub";
import Study from "./pages/Study";
import PublicPortal from "./pages/PublicPortal";
import PublicCollection from "./pages/PublicCollection";
import NotFound from "./pages/NotFound";
import { SessionWatcher } from "@/components/SessionWatcher";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionWatcher />
        <Routes>
          <Route path="/" element={<Folders />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/folders" element={<Folders />} />
          <Route path="/folder/:id" element={<Folder />} />
          <Route path="/list/:id" element={<ListDetail />} />
          <Route path="/list/:id/games" element={<GamesHub />} />
          <Route path="/list/:id/study" element={<Study />} />
          <Route path="/collection/:id" element={<Collection />} />
          <Route path="/collection/:id/games" element={<GamesHub />} />
          <Route path="/collection/:id/study" element={<Study />} />
          <Route path="/portal" element={<PublicPortal />} />
          <Route path="/portal/folder/:id" element={<Folder />} />
          <Route path="/portal/list/:id" element={<ListDetail />} />
          <Route path="/portal/list/:id/games" element={<GamesHub />} />
          <Route path="/portal/list/:id/study" element={<Study />} />
          <Route path="/portal/collection/:collectionId" element={<PublicCollection />} />
          <Route path="/portal/collection/:collectionId/study" element={<Study />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
