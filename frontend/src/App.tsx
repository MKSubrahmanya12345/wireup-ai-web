import type { ReactNode } from "react";
import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "./store/useAuthStore.ts";
import { Navbar } from "./components/layout/Navbar";

const HeroPage = lazy(() => import("./pages/HeroPage.tsx"));
const AuthPage = lazy(() => import("./pages/AuthPage.tsx"));
const HomePage = lazy(() => import("./pages/HomePage.tsx"));
const IdeationPage = lazy(() => import("./pages/IdeationPage.tsx"));
const ComponentsPage = lazy(() => import("./pages/ComponentsPage.tsx"));
const BuildNewPage = lazy(() => import("./pages/BuildNewPage.tsx"));
const AssemblyPage = lazy(() => import("./pages/AssemblyPage.tsx"));
const ShoppingPage = lazy(() => import("./pages/ShoppingPage.tsx"));
const Simulator3DPage = lazy(() => import("./pages/Simulator3DPage.tsx"));

function RouteLoader(): ReactNode {
  return (
    <div className="app-shell page-bg flex items-center justify-center h-screen bg-[#09090b]">
      <div className="flex flex-col items-center gap-6">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative"
        >
          <div className="h-14 w-14 rounded-full border-2 border-slate-700" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-orange-500"
          />
        </motion.div>
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
          }}
          className="text-sm font-medium text-zinc-500"
        >
          Loading...
        </motion.p>
      </div>
    </div>
  );
}

function App(): ReactNode {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (isCheckingAuth) {
    return <RouteLoader />;
  }

  return (
    <div className="app-shell flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<HeroPage />} />
            <Route
              path="/auth"
              element={!authUser ? <AuthPage /> : <Navigate to="/home" />}
            />
            <Route
              path="/home"
              element={authUser ? <HomePage /> : <Navigate to="/auth" />}
            />
            <Route
              path="/project/:id/ideation"
              element={authUser ? <IdeationPage /> : <Navigate to="/auth" />}
            />
            <Route
              path="/project/:id/components"
              element={authUser ? <ComponentsPage /> : <Navigate to="/auth" />}
            />
            <Route
              path="/project/:id/build"
              element={authUser ? <BuildNewPage /> : <Navigate to="/auth" />}
            />
            <Route
              path="/project/:id/assembly"
              element={authUser ? <AssemblyPage /> : <Navigate to="/auth" />}
            />
            <Route
              path="/project/:id/shopping"
              element={authUser ? <ShoppingPage /> : <Navigate to="/auth" />}
            />
            <Route
              path="/project/:id/simulator-3d"
              element={authUser ? <Simulator3DPage /> : <Navigate to="/auth" />}
            />
            <Route path="/project/:id" element={<Navigate to="build" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

export default App;
