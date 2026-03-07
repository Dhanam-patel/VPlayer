import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Home, LayoutDashboard, Sparkles } from "lucide-react";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import AudienceAnalysisPage from "./pages/AudienceAnalysisPage";

export default function App() {
  const [activePage, setActivePage] = useState("home");

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "dashboard", label: "Generate", icon: LayoutDashboard },
    { id: "analysis", label: "Audience Insights", icon: BarChart3 },
  ];

  const renderPage = () => {
    if (activePage === "dashboard") {
      return <DashboardPage />;
    }

    if (activePage === "analysis") {
      return <AudienceAnalysisPage />;
    }

    return (
      <HomePage
        onGoDashboard={() => setActivePage("dashboard")}
        onGoAnalysis={() => setActivePage("analysis")}
      />
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.2),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.25),transparent_35%),radial-gradient(circle_at_50%_80%,rgba(59,130,246,0.2),transparent_45%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-8 md:px-8 xl:px-10">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-lg"
        >
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-white/15 bg-white/10 p-2">
              <Sparkles className="h-4 w-4 text-cyan-300" />
            </span>
            <div>
              <h1 className="bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-xl font-semibold text-transparent">
                StoryFlow
              </h1>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActivePage(item.id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    active
                      ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                      : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </motion.header>

        <motion.section
          key={activePage}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {renderPage()}
        </motion.section>
      </div>
    </div>
  );
}
