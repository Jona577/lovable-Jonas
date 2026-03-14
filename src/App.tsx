import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import ResetNutrition from "./pages/ResetNutrition";
import ResetAll from "./pages/ResetAll";
import { SoundProvider } from "./contexts/SoundContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useState, useEffect } from "react";
import { useSupabaseSync } from "./hooks/useSupabaseSync";

const queryClient = new QueryClient();

/**
 * Wrapper que decide se mostra a tela de login ou o app.
 * O usuário pode optar por "continuar sem conta" (skip).
 */
function AppRouter() {
  const { user, loading } = useAuth();
  
  // Ativa o SyncMaster de background (apenas vai rodar com sucesso se houver 'user')
  useSupabaseSync();

  // Força uma recarga passiva do React sem F5 quando os dados do celular/nuvem chegam
  const [syncVersion, setSyncVersion] = useState(0);

  useEffect(() => {
    const handleSync = () => setSyncVersion(v => v + 1);
    window.addEventListener('local-storage-sync-completed', handleSync);
    return () => window.removeEventListener('local-storage-sync-completed', handleSync);
  }, []);

  const [skippedAuth, setSkippedAuth] = useState(() => {
    return localStorage.getItem('produtivity_auth_skipped') === 'true';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('produtivity_dark_mode');
    return stored ? JSON.parse(stored) : false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    const newVal = !isDarkMode;
    setIsDarkMode(newVal);
    localStorage.setItem('produtivity_dark_mode', JSON.stringify(newVal));
  };

  // Loading screen
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-black' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl bg-white/10 ring-1 ring-black/5 dark:ring-white/10`}>
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <span className={`text-xl font-black tracking-tight lowercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            produtivity
          </span>
        </div>
      </div>
    );
  }

  // Se não está autenticado e não pulou, mostra a tela de login
  if (!user && !skippedAuth) {
    return (
      <div className="relative">
        <AuthPage isDarkMode={isDarkMode} onToggleDark={toggleDarkMode} />
        {/* Botão para continuar sem conta */}
        <button
          onClick={() => {
            setSkippedAuth(true);
            localStorage.setItem('produtivity_auth_skipped', 'true');
          }}
          className={`fixed bottom-6 right-6 px-5 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg z-50 ${isDarkMode
            ? 'bg-slate-800 text-white/50 hover:text-white hover:bg-slate-700 border border-slate-700'
            : 'bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          Continuar sem conta →
        </button>
      </div>
    );
  }

  // Usuário autenticado OU pulou o login
  return (
    <BrowserRouter key={syncVersion} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/reset" element={<ResetNutrition />} />
        <Route path="/reset-all" element={<ResetAll />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <SoundProvider>
          <Toaster />
          <Sonner />
          <AppRouter />
        </SoundProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
