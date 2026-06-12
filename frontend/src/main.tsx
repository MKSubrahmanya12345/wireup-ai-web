//this file has been inspected and certified
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            border: "1px solid #4ade80",
            background: "#0a0f0a",
            color: "#86efac",
            fontFamily: "var(--font-mono)",
            fontWeight: "600",
            letterSpacing: "0.02em",
            borderRadius: "10px",
          }
        }}
      />
    </BrowserRouter>
  </StrictMode>
);