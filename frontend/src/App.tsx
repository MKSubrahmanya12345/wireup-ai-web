// ??$$$ newer code
import type { ReactNode } from "react";
import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "./store/useAuthStore.ts";

const HeroPage = lazy(() => import("./pages/HeroPage.tsx"));
const AuthPage = lazy(() => import("./pages/AuthPage.tsx"));
const HomePage = lazy(() => import("./pages/HomePage.tsx"));
const ProjectLayout = lazy(() => import("./components/shared/ProjectLayout.tsx"));

const IdeationPage = lazy(() => import("./pages/IdeationPage.tsx"));
const ComponentsPage = lazy(() => import("./pages/ComponentsPage.tsx"));
const BuildPage = lazy(() => import("./pages/BuildPage.tsx"));
const AssemblyPage = lazy(() => import("./pages/AssemblyPage.tsx"));
const ShoppingPage = lazy(() => import("./pages/ShoppingPage.tsx"));
const Simulator3DPage = lazy(() => import("./pages/Simulator3DPage.tsx"));
// ??$$$ NEW FLOW
const BuildNewPage = lazy(() => import("./pages/BuildNewPage.tsx"));

function RouteLoader(): ReactNode {
  return (
    <div className="app-shell page-bg flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="surface w-full max-w-sm rounded-xl p-6 text-center"
      >
        <div className="mx-auto mb-4 h-7 w-7 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        <p className="text-sm font-medium muted">Loading...</p>
      </motion.div>
    </div>
  );
}

function App(): ReactNode {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (isCheckingAuth) {
    return (
      <div className="app-shell page-bg flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="surface w-full max-w-sm rounded-xl p-6 text-center"
        >
          <div className="mx-auto mb-4 h-7 w-7 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
          <p className="text-sm font-medium muted">Loading...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HeroPage />} />

          <Route
            path="/auth"
            element={!authUser ? <AuthPage /> : <Navigate to="/home" />}
          />

          {/* Protected */}
          <Route
            path="/home"
            element={authUser ? <HomePage /> : <Navigate to="/auth" />}
          />

          <Route
            path="/test-simulator"
            element={authUser ? <Simulator3DPage /> : <Navigate to="/auth" />}
          />

          {/* Project pipeline */}
          <Route
            path="/project/:id"
            element={authUser ? <ProjectLayout /> : <Navigate to="/auth" />}
          >
            <Route index element={<Navigate to="ideation" replace />} />
            <Route path="ideation" element={<IdeationPage />} />
            <Route path="components" element={<ComponentsPage />} />
            <Route path="build" element={<BuildPage />} />
            <Route path="assembly" element={<AssemblyPage />} />
            <Route path="shopping" element={<ShoppingPage />} />
          </Route>

          {/* ??$$$ NEW FLOW */}
          <Route
            path="/project/:id/build-new"
            element={authUser ? <BuildNewPage /> : <Navigate to="/auth" />}
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;