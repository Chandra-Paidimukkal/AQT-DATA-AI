import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { NeuralBackground } from "@/components/shared";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import UploadExtractPage from "./pages/UploadExtractPage";
import JobsPage from "./pages/JobsPage";
import SchemasPage from "./pages/SchemasPage";
import SessionsPage from "./pages/SessionsPage";
import AliasesPage from "./pages/AliasesPage";
import FilesPage from "./pages/FilesPage";
import ArchitecturePage from "./pages/ArchitecturePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <div className="min-h-screen bg-background relative">
          <NeuralBackground />
          <Navbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/upload" element={<UploadExtractPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/schemas" element={<SchemasPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/aliases" element={<AliasesPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/architecture" element={<ArchitecturePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
