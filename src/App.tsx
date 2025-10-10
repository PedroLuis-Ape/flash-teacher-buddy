import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Collection from "./pages/Collection";
import GamesHub from "./pages/GamesHub";
import Study from "./pages/Study";
import PublicPortal from "./pages/PublicPortal";
import PublicCollection from "./pages/PublicCollection";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/collection/:id" element={<Collection />} />
          <Route path="/collection/:id/games" element={<GamesHub />} />
          <Route path="/collection/:id/study" element={<Study />} />
          <Route path="/portal" element={<PublicPortal />} />
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
