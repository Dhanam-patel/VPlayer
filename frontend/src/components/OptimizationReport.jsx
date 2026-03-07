import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ChevronDown } from "lucide-react";

function ScorePill({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">{label}</p>
      <p className="text-lg font-bold text-white">{value ?? "--"}</p>
    </div>
  );
}

export default function OptimizationReport({ optimizationReport = {}, variants }) {
  const [openSuggestion, setOpenSuggestion] = useState(null);

  const qualityScores = optimizationReport?.quality_scores || {};
  const topPriorities = Array.isArray(optimizationReport?.top_priorities)
    ? optimizationReport.top_priorities
    : [];
  const perEpisodeSuggestions = Array.isArray(optimizationReport?.per_episode_suggestions)
    ? optimizationReport.per_episode_suggestions
    : [];

  // Group suggestions by episode_number so each episode gets a single accordion
  const groupedSuggestions = [];
  const episodeMap = new Map();
  for (const entry of perEpisodeSuggestions) {
    const epNum = entry?.episode_number ?? null;
    const key = epNum != null ? epNum : "general";
    if (!episodeMap.has(key)) {
      const group = { key, episodeNumber: epNum, suggestions: [] };
      episodeMap.set(key, group);
      groupedSuggestions.push(group);
    }
    const text = entry?.suggestion || entry?.notes || JSON.stringify(entry);
    episodeMap.get(key).suggestions.push(text);
  }

  // Sort: general (0 or null) first, then by episode number
  groupedSuggestions.sort((a, b) => {
    const aNum = typeof a.episodeNumber === "number" && a.episodeNumber > 0 ? a.episodeNumber : 0;
    const bNum = typeof b.episodeNumber === "number" && b.episodeNumber > 0 ? b.episodeNumber : 0;
    return aNum - bNum;
  });

  function episodeLabel(epNum) {
    if (epNum == null || epNum === 0) return "General Suggestions";
    return `Episode ${epNum}`;
  }

  return (
    <motion.section
      variants={variants}
      className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg"
    >
      <h3 className="text-base font-semibold text-white">Optimization Report</h3>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Object.keys(qualityScores).length === 0 ? (
          <p className="col-span-full text-sm text-white/60">No quality scores provided.</p>
        ) : (
          Object.entries(qualityScores).map(([label, value]) => (
            <ScorePill
              key={label}
              label={label.replaceAll("_", " ")}
              value={typeof value === "number" ? value.toFixed(1) : String(value)}
            />
          ))
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.13em] text-white/75">
            Top Priorities
          </h4>
          {topPriorities.length === 0 ? (
            <p className="mt-2 text-sm text-white/60">No priorities returned.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {topPriorities.map((priority, index) => (
                <li
                  key={`priority-${index}`}
                  className="flex items-start gap-2 rounded-lg border border-emerald-300/15 bg-emerald-300/5 px-3 py-2 text-sm text-white/85"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.13em] text-white/75">
            Episode Suggestions
          </h4>

          {groupedSuggestions.length === 0 ? (
            <p className="mt-2 text-sm text-white/60">No episode-specific suggestions.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {groupedSuggestions.map((group) => {
                const title = episodeLabel(group.episodeNumber);
                const isOpen = openSuggestion === group.key;

                return (
                  <div
                    key={`suggestion-${group.key}`}
                    className="overflow-hidden rounded-lg border border-white/10 bg-black/20"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenSuggestion(isOpen ? null : group.key)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                    >
                      <span className="text-sm font-medium text-white/85">{title}</span>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/50">
                          {group.suggestions.length}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 text-white/60 transition ${
                            isOpen ? "rotate-180" : "rotate-0"
                          }`}
                        />
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                        >
                          <div className="border-t border-white/10 px-3 py-2">
                            {group.suggestions.length === 1 ? (
                              <p className="text-sm text-white/75">{group.suggestions[0]}</p>
                            ) : (
                              <ul className="space-y-1.5">
                                {group.suggestions.map((text, i) => (
                                  <li
                                    key={`${group.key}-${i}`}
                                    className="flex items-start gap-2 text-sm text-white/75"
                                  >
                                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/40" />
                                    <span>{text}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
