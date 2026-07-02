import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "motion/react";
import App from "./App";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./hooks/useAuth";
import { LanguageProvider } from "./hooks/useLanguage";
import { CompareProvider } from "./hooks/useCompare";
import { ToastProvider } from "./components/ui/toast";
import { USE_MOCK_DATA } from "./lib/supabase";
import { initMonitoring } from "./lib/monitoring";
import "./index.css";

// Start error monitoring as early as possible (no-op unless VITE_SENTRY_DSN is set).
void initMonitoring();

// When connected to a real Supabase backend, purge stale keys left by the
// in-memory mock layer. A leftover `influencehub_session` (a mock user id like
// "brand-user-0007") otherwise leaks into Supabase queries as a bogus UUID.
if (!USE_MOCK_DATA) {
  ["influencehub_session", "influencehub_mockdb_v1", "influencehub_mockdb_v2"].forEach((k) =>
    localStorage.removeItem(k),
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <LanguageProvider>
            <AuthProvider>
              <CompareProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </CompareProvider>
            </AuthProvider>
          </LanguageProvider>
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  </React.StrictMode>,
);
