import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import BudgetList from "./pages/BudgetList";
import NewBudget from "./pages/NewBudget";
import Cataleg from "./pages/Cataleg";
import Proveidors from "./pages/Proveidors";
import Configuracio from "./pages/Configuracio";
import ObresList from "./pages/ObresList";
import ObraDetail from "./pages/ObraDetail";
import AnnexList from "./pages/AnnexList";
import AnnexDetail from "./pages/AnnexDetail";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.active === false) {
    // Deactivated account: force sign-out and bounce to login.
    void signOut();
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ObresRoute({ children }: { children: React.ReactNode }) {
  const { canAccessObres, loading } = useAuth();
  if (loading) return null;
  if (!canAccessObres) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function NoAdministrativaRoute({ children }: { children: React.ReactNode }) {
  const { isAdministrativa, loading } = useAuth();
  if (loading) return null;
  if (isAdministrativa) return <Navigate to="/control-obres" replace />;
  return <>{children}</>;
}

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pressupostos" element={<NoAdministrativaRoute><BudgetList /></NoAdministrativaRoute>} />
        <Route path="/nou-pressupost" element={<NoAdministrativaRoute><NewBudget /></NoAdministrativaRoute>} />
        <Route path="/pressupostos/:budgetId/annexos" element={<NoAdministrativaRoute><AnnexList /></NoAdministrativaRoute>} />
        <Route path="/pressupostos/:budgetId/annexos/:annexId" element={<NoAdministrativaRoute><AnnexDetail /></NoAdministrativaRoute>} />
        <Route path="/cataleg" element={<NoAdministrativaRoute><Cataleg /></NoAdministrativaRoute>} />
        <Route path="/proveidors" element={<AdminRoute><Proveidors /></AdminRoute>} />
        <Route path="/control-obres" element={<ObresRoute><ObresList /></ObresRoute>} />
        <Route path="/control-obres/:id" element={<ObresRoute><ObraDetail /></ObresRoute>} />
        <Route path="/configuracio" element={<AdminRoute><Configuracio /></AdminRoute>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
