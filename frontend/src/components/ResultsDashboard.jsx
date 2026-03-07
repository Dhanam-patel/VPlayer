import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, Eye, Flame, Loader2, Sparkles, Zap } from "lucide-react";
import EpisodeTimeline from "./EpisodeTimeline";
import EpisodeScripts from "./EpisodeScripts";
import OptimizationReport from "./OptimizationReport";
import generateStoryPdf from "../utils/generateStoryPdf";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

function HeaderBadge({ label, value }) {
  return (
    <div className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
      <span className="text-cyan-200/85">{label}:</span> {value}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <motion.section
      variants={itemVariants}
      className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg"
    >
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <div className="mt-3">{children}</div>
    </motion.section>
  );
}

function EmotionalArcPanel({ emotionalArc = {} }) {
  const beats = Array.isArray(emotionalArc?.beats) ? emotionalArc.beats : [];
  const coherence = emotionalArc?.coherence_score;

  return (
    <Panel title="Emotional Arc">
      <div className="mb-4 inline-flex items-baseline gap-3 rounded-lg border border-blue-300/20 bg-blue-300/10 px-4 py-2.5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.13em] text-blue-100/75">Coherence Score</p>
          <p className="text-3xl font-extrabold text-white">
            {typeof coherence === "number" ? coherence.toFixed(1) : "--"}
          </p>
        </div>
      </div>

      {beats.length === 0 ? (
        <p className="text-sm text-white/60">No emotional beats available.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {beats.map((beat, index) => (
            <div
              key={`emotion-${beat?.episode_number ?? index}`}
              className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80"
            >
              {typeof beat === "string" ? (
                beat
              ) : (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/50">
                    Episode {beat?.episode_number ?? index + 1}
                  </p>
                  <p className="font-medium text-white/90">
                    {beat?.dominant_emotion || "Emotion not set"}
                  </p>
                  <p className="text-xs text-blue-200/90">
                    Intensity: {beat?.intensity_score ?? "--"}/10
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RetentionRiskPanel({ retentionAnalysis = {} }) {
  const overallRisk = retentionAnalysis?.overall_risk || "Unknown";
  const episodes = Array.isArray(retentionAnalysis?.episodes)
    ? retentionAnalysis.episodes
    : [];

  return (
    <Panel title="Retention Risk">
      <div className="mb-4 inline-flex items-baseline gap-3 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-2.5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-amber-100/80">
            Overall Risk
          </p>
          <p className="text-lg font-bold text-white">{overallRisk}</p>
        </div>
      </div>

      {episodes.length === 0 ? (
        <p className="text-sm text-white/60">No retention analysis returned.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {episodes.map((episodeRisk, index) => {
            const retentionRaw = episodeRisk?.retention_score;
            const retentionScore = Number.isFinite(Number(retentionRaw))
              ? Number(retentionRaw)
              : 0;
            const riskScore = Math.max(0, Math.min(100, 100 - retentionScore));
            const fixes = Array.isArray(episodeRisk?.suggested_fixes)
              ? episodeRisk.suggested_fixes
              : [];

            return (
              <div
                key={`risk-${episodeRisk?.episode_number ?? index}`}
                className="rounded-lg border border-white/10 bg-black/20 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/50">
                    Episode {episodeRisk?.episode_number ?? index + 1}
                  </p>
                  <p className="text-sm font-semibold text-rose-200">Risk {riskScore}%</p>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500"
                    initial={{ width: "0%" }}
                    animate={{ width: `${Math.max(0, Math.min(riskScore, 100))}%` }}
                    transition={{ type: "spring", bounce: 0.2, duration: 1 }}
                  />
                </div>

                <p className="mt-2 text-xs text-white/65">
                  Retention: {retentionScore}%
                </p>
                {episodeRisk?.risk_zone && (
                  <p className="mt-1 text-xs text-amber-200/85">
                    Zone: {episodeRisk.risk_zone}
                  </p>
                )}

                {fixes.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
                    {fixes.map((fix, fixIndex) => (
                      <li key={`fix-${episodeRisk?.episode_number ?? index}-${fixIndex}`}>{fix}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function ScoreRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-white/80">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-bold text-white">{value ?? "--"}</span>
    </div>
  );
}

function CliffhangerPanel({ cliffhangerAnalysis = {} }) {
  const averageScore = cliffhangerAnalysis?.average_score;
  const episodes = Array.isArray(cliffhangerAnalysis?.episodes)
    ? cliffhangerAnalysis.episodes
    : [];

  return (
    <Panel title="Cliffhanger Scores">
      <div className="mb-4 inline-flex items-baseline gap-3 rounded-lg border border-rose-300/20 bg-rose-300/10 px-4 py-2.5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-rose-100/80">
            Average Score
          </p>
          <p className="text-lg font-bold text-white">
            {typeof averageScore === "number" ? averageScore.toFixed(1) : "--"}
          </p>
        </div>
      </div>

      {episodes.length === 0 ? (
        <p className="text-sm text-white/60">No cliffhanger breakdown available.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {episodes.map((episode, index) => (
            <div
              key={`cliff-${episode?.episode_number ?? index}`}
              className="rounded-lg border border-white/10 bg-black/20 p-4"
            >
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-white/50">
                Episode {episode?.episode_number ?? index + 1}
              </p>
              <div className="space-y-2">
                <ScoreRow
                  icon={<Eye className="h-4 w-4 text-cyan-300" />}
                  label="Curiosity"
                  value={episode?.curiosity_score}
                />
                <ScoreRow
                  icon={<Zap className="h-4 w-4 text-amber-300" />}
                  label="Stakes"
                  value={episode?.stakes_score}
                />
                <ScoreRow
                  icon={<Flame className="h-4 w-4 text-rose-300" />}
                  label="Emotional"
                  value={episode?.emotional_score}
                />
              </div>
              {episode?.explanation && (
                <p className="mt-2 text-xs text-white/70">{episode.explanation}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function ResultsDashboard({ analysisData }) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!analysisData) return;
    setIsGeneratingPdf(true);
    try {
      generateStoryPdf(analysisData);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [analysisData]);

  if (!analysisData) {
    return null;
  }

  const runId = analysisData?.run_id != null ? String(analysisData.run_id) : "unknown";
  const shortRunId = runId.length > 10 ? `${runId.slice(0, 10)}...` : runId;
  const storyIdea = analysisData?.story_idea || "No story idea in payload.";
  const revisionsCompleted = analysisData?.revisions_completed ?? 0;
  const createdAt = analysisData?.created_at
    ? new Date(analysisData.created_at).toLocaleString()
    : "Unknown";

  const episodePlan = Array.isArray(analysisData?.episode_plan)
    ? analysisData.episode_plan
    : [];
  const episodeScripts = analysisData?.episode_scripts || null;
  const emotionalArc = analysisData?.emotional_arc || {};
  const retentionAnalysis = analysisData?.retention_analysis || {};
  const cliffhangerAnalysis = analysisData?.cliffhanger_analysis || {};
  const optimizationReport = analysisData?.optimization_report || {};

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* ---- Download Button ---- */}
      <motion.div variants={itemVariants} className="flex justify-end">
        <button
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGeneratingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isGeneratingPdf ? "Generating PDF…" : "Download PDF"}
        </button>
      </motion.div>

      {/* ---- Story Brief ---- */}
      <motion.section
        variants={itemVariants}
        className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-cyan-200">
            <Sparkles className="h-4 w-4" />
            <p className="text-xs uppercase tracking-[0.15em] text-white/65">Story Brief</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HeaderBadge label="Revisions" value={revisionsCompleted} />
            <HeaderBadge label="Run" value={shortRunId} />
            <HeaderBadge label="Created" value={createdAt} />
          </div>
        </div>

        <p className="mt-3 text-lg italic leading-relaxed text-white/90 sm:text-xl">
          &ldquo;{storyIdea}&rdquo;
        </p>
      </motion.section>

      {/* ---- Full Episode Scripts (top, all expanded) ---- */}
      {episodeScripts && (
        <motion.div variants={itemVariants}>
          <EpisodeScripts episodeScripts={episodeScripts} />
        </motion.div>
      )}

      {/* ---- Episode Timeline ---- */}
      <motion.div variants={itemVariants}>
        <EpisodeTimeline episodePlan={episodePlan} />
      </motion.div>

      {/* ---- Analysis Panels (stacked full-width) ---- */}
      <EmotionalArcPanel emotionalArc={emotionalArc} />
      <RetentionRiskPanel retentionAnalysis={retentionAnalysis} />
      <CliffhangerPanel cliffhangerAnalysis={cliffhangerAnalysis} />

      {/* ---- Optimization Report ---- */}
      <OptimizationReport
        optimizationReport={optimizationReport}
        variants={itemVariants}
      />
    </motion.div>
  );
}
