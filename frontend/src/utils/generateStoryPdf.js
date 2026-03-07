import { jsPDF } from "jspdf";

// --- Layout constants (A4 in pt) ---
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 30;
const BOTTOM_LIMIT = PAGE_H - MARGIN - FOOTER_H;

// --- Colors ---
const COLOR = {
  black: [30, 30, 30],
  heading: [15, 23, 42], // slate-900
  body: [51, 65, 85], // slate-600
  muted: [100, 116, 139], // slate-500
  accent: [8, 145, 178], // cyan-600
  rule: [203, 213, 225], // slate-300
};

// --- Helpers ---

/** Ensure enough vertical space; add a new page if not. Returns updated y. */
function ensureSpace(pdf, y, needed) {
  if (y + needed > BOTTOM_LIMIT) {
    pdf.addPage();
    addFooter(pdf);
    return MARGIN;
  }
  return y;
}

/** Draw page number footer on the current page. */
function addFooter(pdf) {
  const pageNum = pdf.internal.getNumberOfPages();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLOR.muted);
  pdf.text(`Page ${pageNum}`, PAGE_W / 2, PAGE_H - 20, { align: "center" });
}

/** Draw a thin horizontal rule. Returns y after the rule + spacing. */
function drawRule(pdf, y, spacing = 10) {
  pdf.setDrawColor(...COLOR.rule);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  return y + spacing;
}

/** Write wrapped body text. Returns updated y. */
function writeBody(pdf, text, y, { fontSize = 10, color = COLOR.body, lineHeight = 1.5 } = {}) {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontSize);
  pdf.setTextColor(...color);

  const leading = fontSize * lineHeight;
  const lines = pdf.splitTextToSize(text, CONTENT_W);

  for (const line of lines) {
    y = ensureSpace(pdf, y, leading);
    pdf.text(line, MARGIN, y);
    y += leading;
  }
  return y;
}

/** Write a section heading (large). Returns updated y. */
function writeHeading(pdf, text, y) {
  y = ensureSpace(pdf, y, 30);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(...COLOR.heading);
  pdf.text(text, MARGIN, y);
  y += 8;
  y = drawRule(pdf, y);
  return y;
}

/** Write a sub-heading (medium). Returns updated y. */
function writeSubheading(pdf, text, y) {
  y = ensureSpace(pdf, y, 22);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...COLOR.heading);
  pdf.text(text, MARGIN, y);
  return y + 16;
}

/** Write a label: value pair. Returns updated y. */
function writeField(pdf, label, value, y) {
  y = ensureSpace(pdf, y, 16);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...COLOR.muted);
  pdf.text(`${label}:`, MARGIN, y);

  const labelWidth = pdf.getTextWidth(`${label}: `);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLOR.body);

  const remaining = CONTENT_W - labelWidth;
  const valLines = pdf.splitTextToSize(String(value), remaining);
  for (let i = 0; i < valLines.length; i++) {
    if (i === 0) {
      pdf.text(valLines[i], MARGIN + labelWidth, y);
    } else {
      y += 14;
      y = ensureSpace(pdf, y, 14);
      pdf.text(valLines[i], MARGIN + labelWidth, y);
    }
  }
  return y + 16;
}

/** Write a bullet list. Returns updated y. */
function writeBulletList(pdf, items, y, indent = 10) {
  const leading = 15;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...COLOR.body);

  for (const item of items) {
    const lines = pdf.splitTextToSize(String(item), CONTENT_W - indent - 10);
    for (let i = 0; i < lines.length; i++) {
      y = ensureSpace(pdf, y, leading);
      if (i === 0) {
        pdf.text("\u2022", MARGIN + indent, y);
        pdf.text(lines[i], MARGIN + indent + 10, y);
      } else {
        pdf.text(lines[i], MARGIN + indent + 10, y);
      }
      y += leading;
    }
  }
  return y;
}

// --- Section renderers ---

function renderStoryBrief(pdf, data, y) {
  y = writeHeading(pdf, "Story Brief", y);
  y = writeBody(pdf, `"${data.story_idea || "N/A"}"`, y, { fontSize: 12, color: COLOR.black });
  y += 6;
  y = writeField(pdf, "Run ID", data.run_id ?? "unknown", y);
  y = writeField(pdf, "Revisions", data.revisions_completed ?? 0, y);
  if (data.created_at) {
    y = writeField(pdf, "Created", new Date(data.created_at).toLocaleString(), y);
  }
  return y + 6;
}

function renderEpisodeScripts(pdf, episodeScripts, y) {
  if (!episodeScripts) return y;

  const scripts = Array.isArray(episodeScripts.scripts) ? episodeScripts.scripts : [];
  if (scripts.length === 0) return y;

  y = writeHeading(pdf, "Episode Scripts", y);

  if (episodeScripts.total_word_count) {
    y = writeField(pdf, "Total Word Count", episodeScripts.total_word_count.toLocaleString(), y);
  }
  if (episodeScripts.series_continuity_summary) {
    y = writeField(pdf, "Series Summary", episodeScripts.series_continuity_summary, y);
    y += 4;
  }

  for (const script of scripts) {
    y = writeSubheading(pdf, `Episode ${script.episode_number} \u2014 ${script.title || "Untitled"}`, y);

    if (script.word_count) {
      y = writeField(pdf, "Word Count", script.word_count.toLocaleString(), y);
    }

    // Script body paragraphs
    const paragraphs = (script.script || "").split(/\n\n+/).filter(Boolean);
    for (const para of paragraphs) {
      y = writeBody(pdf, para.trim(), y);
      y += 4;
    }

    // Scene directions
    const directions = Array.isArray(script.scene_directions) ? script.scene_directions : [];
    if (directions.length > 0) {
      y += 4;
      y = ensureSpace(pdf, y, 20);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...COLOR.muted);
      pdf.text("Scene Directions", MARGIN, y);
      y += 14;
      y = writeBulletList(pdf, directions, y);
    }

    // Continuity notes
    if (script.continuity_notes) {
      y += 4;
      y = ensureSpace(pdf, y, 20);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...COLOR.muted);
      pdf.text("Continuity Notes", MARGIN, y);
      y += 14;
      y = writeBody(pdf, script.continuity_notes, y);
    }

    y += 10;
    y = drawRule(pdf, y, 12);
  }

  return y;
}

function renderEpisodeTimeline(pdf, episodePlan, y) {
  if (!Array.isArray(episodePlan) || episodePlan.length === 0) return y;

  y = writeHeading(pdf, "Episode Timeline", y);

  for (const ep of episodePlan) {
    y = writeSubheading(pdf, `Episode ${ep.episode_number}`, y);

    if (ep.hook) {
      y = writeField(pdf, "Hook", ep.hook, y);
    }

    const beats = Array.isArray(ep.beats) ? ep.beats : [];
    if (beats.length > 0) {
      y = ensureSpace(pdf, y, 16);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...COLOR.muted);
      pdf.text("Beats", MARGIN, y);
      y += 14;
      y = writeBulletList(pdf, beats, y);
    }

    if (ep.cliffhanger) {
      y = writeField(pdf, "Cliffhanger", ep.cliffhanger, y);
    }

    y += 6;
  }

  return y;
}

function renderEmotionalArc(pdf, emotionalArc, y) {
  if (!emotionalArc || Object.keys(emotionalArc).length === 0) return y;

  y = writeHeading(pdf, "Emotional Arc", y);

  if (typeof emotionalArc.coherence_score === "number") {
    y = writeField(pdf, "Coherence Score", emotionalArc.coherence_score.toFixed(1), y);
  }

  const beats = Array.isArray(emotionalArc.beats) ? emotionalArc.beats : [];
  for (const beat of beats) {
    if (typeof beat === "string") {
      y = writeBody(pdf, beat, y);
      y += 4;
      continue;
    }
    y = ensureSpace(pdf, y, 40);
    y = writeField(pdf, `Episode ${beat.episode_number ?? "?"}`, beat.dominant_emotion || "N/A", y);
    if (beat.intensity_score != null) {
      y = writeField(pdf, "  Intensity", `${beat.intensity_score}/10`, y);
    }
  }

  return y + 6;
}

function renderRetentionRisk(pdf, retentionAnalysis, y) {
  if (!retentionAnalysis || Object.keys(retentionAnalysis).length === 0) return y;

  y = writeHeading(pdf, "Retention Risk", y);
  y = writeField(pdf, "Overall Risk", retentionAnalysis.overall_risk || "Unknown", y);

  const episodes = Array.isArray(retentionAnalysis.episodes) ? retentionAnalysis.episodes : [];
  for (const ep of episodes) {
    y = writeSubheading(pdf, `Episode ${ep.episode_number ?? "?"}`, y);

    const retention = Number.isFinite(Number(ep.retention_score)) ? Number(ep.retention_score) : 0;
    y = writeField(pdf, "Retention Score", `${retention}%`, y);

    if (ep.risk_zone) {
      y = writeField(pdf, "Risk Zone", ep.risk_zone, y);
    }

    const fixes = Array.isArray(ep.suggested_fixes) ? ep.suggested_fixes : [];
    if (fixes.length > 0) {
      y = ensureSpace(pdf, y, 16);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(...COLOR.muted);
      pdf.text("Suggested Fixes", MARGIN, y);
      y += 14;
      y = writeBulletList(pdf, fixes, y);
    }
    y += 4;
  }

  return y;
}

function renderCliffhangers(pdf, cliffhangerAnalysis, y) {
  if (!cliffhangerAnalysis || Object.keys(cliffhangerAnalysis).length === 0) return y;

  y = writeHeading(pdf, "Cliffhanger Scores", y);

  if (typeof cliffhangerAnalysis.average_score === "number") {
    y = writeField(pdf, "Average Score", cliffhangerAnalysis.average_score.toFixed(1), y);
  }

  const episodes = Array.isArray(cliffhangerAnalysis.episodes) ? cliffhangerAnalysis.episodes : [];
  for (const ep of episodes) {
    y = writeSubheading(pdf, `Episode ${ep.episode_number ?? "?"}`, y);
    if (ep.curiosity_score != null) y = writeField(pdf, "Curiosity", ep.curiosity_score, y);
    if (ep.stakes_score != null) y = writeField(pdf, "Stakes", ep.stakes_score, y);
    if (ep.emotional_score != null) y = writeField(pdf, "Emotional", ep.emotional_score, y);
    if (ep.explanation) {
      y = writeBody(pdf, ep.explanation, y);
      y += 4;
    }
  }

  return y;
}

function renderOptimizationReport(pdf, report, y) {
  if (!report || Object.keys(report).length === 0) return y;

  y = writeHeading(pdf, "Optimization Report", y);

  // Quality scores
  const scores = report.quality_scores || {};
  const scoreKeys = Object.keys(scores);
  if (scoreKeys.length > 0) {
    y = ensureSpace(pdf, y, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...COLOR.muted);
    pdf.text("Quality Scores", MARGIN, y);
    y += 14;

    for (const key of scoreKeys) {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      y = writeField(pdf, label, scores[key], y);
    }
  }

  // Top priorities
  const priorities = Array.isArray(report.top_priorities) ? report.top_priorities : [];
  if (priorities.length > 0) {
    y += 4;
    y = ensureSpace(pdf, y, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...COLOR.muted);
    pdf.text("Top Priorities", MARGIN, y);
    y += 14;
    y = writeBulletList(pdf, priorities, y);
  }

  // Per-episode suggestions
  const suggestions = Array.isArray(report.per_episode_suggestions) ? report.per_episode_suggestions : [];
  if (suggestions.length > 0) {
    y += 4;
    y = ensureSpace(pdf, y, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...COLOR.muted);
    pdf.text("Per-Episode Suggestions", MARGIN, y);
    y += 14;

    for (const s of suggestions) {
      y = writeField(pdf, `Episode ${s.episode_number ?? "?"}`, s.suggestion || "", y);
    }
  }

  return y;
}

// --- Main export ---

export default function generateStoryPdf(analysisData) {
  const pdf = new jsPDF("p", "pt", "a4");
  addFooter(pdf);

  let y = MARGIN;

  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(...COLOR.heading);
  pdf.text("Story Flow Results", MARGIN, y);
  y += 12;

  // Accent underline
  pdf.setDrawColor(...COLOR.accent);
  pdf.setLineWidth(2);
  pdf.line(MARGIN, y, MARGIN + 120, y);
  y += 20;

  // Sections
  y = renderStoryBrief(pdf, analysisData, y);
  y = renderEpisodeScripts(pdf, analysisData.episode_scripts, y);
  y = renderEpisodeTimeline(pdf, analysisData.episode_plan, y);
  y = renderEmotionalArc(pdf, analysisData.emotional_arc, y);
  y = renderRetentionRisk(pdf, analysisData.retention_analysis, y);
  y = renderCliffhangers(pdf, analysisData.cliffhanger_analysis, y);
  y = renderOptimizationReport(pdf, analysisData.optimization_report, y);

  // Re-stamp footers on all pages
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...COLOR.muted);
    pdf.text(`Page ${i} of ${totalPages}`, PAGE_W / 2, PAGE_H - 20, { align: "center" });
  }

  // Generate filename
  const filename = analysisData?.story_idea
    ? `story-flow-${analysisData.story_idea.slice(0, 30).replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`
    : "story-flow-results.pdf";

  pdf.save(filename);
}
