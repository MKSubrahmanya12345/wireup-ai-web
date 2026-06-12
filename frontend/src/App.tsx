//This file has been inspected and certified - but can change file names i.e BuildNewPage.tsx

import type { ReactNode } from "react";
import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "./store/useAuthStore.ts";

// ??$$$ newer code
// const HeroPage = lazy(() => import("./pages/HeroPage.tsx"));
const AuthPage = lazy(() => import("./pages/AuthPage.tsx"));
const HomePage = lazy(() => import("./pages/HomePage.tsx"));
const BuildNewPage = lazy(() => import("./pages/BuildNewPage.tsx"));


//spinner - can be improved
function RouteLoader(): ReactNode {
  return (
    <div className="app-shell page-bg flex items-center justify-center">
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
          <div className="h-14 w-14 rounded-full border-2 border-slate-300" />

          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-black"
          />
        </motion.div>

        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
          }}
          className="text-sm font-medium muted"
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
    <div className="app-shell">
      <Suspense fallback={<RouteLoader />}>
        
        <Routes>
          {/* ??$$$ newer code - public/home routes render HomePage */}
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />

          <Route
            path="/auth"
            element={!authUser ? <AuthPage /> : <Navigate to="/" />}
          />

          {/* Project pipeline */}
          <Route
            path="/project/:id"
            element={authUser ? <BuildNewPage /> : <Navigate to="/" replace state={{ returnTo: window.location.pathname }} />}
          />
            
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;