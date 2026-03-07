import { jsPDF } from "jspdf";

// ─── Layout constants (A4 in pt) ────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 60;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const FOOTER_ZONE = 40;
const BOTTOM_LIMIT = PAGE_H - FOOTER_ZONE - 20;

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
  black: [20, 20, 20],
  heading: [15, 23, 42],
  sub: [30, 41, 59],
  body: [55, 65, 81],
  muted: [120, 130, 150],
  label: [100, 116, 139],
  accent: [8, 145, 178],
  accentLight: [200, 235, 245],
  rule: [215, 220, 230],
  bgLight: [245, 247, 250],
  white: [255, 255, 255],
};

// ─── PDF Context (avoids passing pdf everywhere) ─────────────────────────────
let _pdf = null;
let _storyTitle = "";

function ensureSpace(y, needed) {
  if (y + needed > BOTTOM_LIMIT) {
    _pdf.addPage();
    return MARGIN_TOP;
  }
  return y;
}

// ─── Primitive drawing helpers ───────────────────────────────────────────────

function drawRule(y, { width = CONTENT_W, color = C.rule, weight = 0.4 } = {}) {
  _pdf.setDrawColor(...color);
  _pdf.setLineWidth(weight);
  _pdf.line(MARGIN_X, y, MARGIN_X + width, y);
  return y + 12;
}

function drawAccentBar(y) {
  _pdf.setFillColor(...C.accent);
  _pdf.rect(MARGIN_X, y, 40, 3, "F");
  return y + 14;
}

// ─── Text primitives ────────────────────────────────────────────────────────

function writeText(text, y, x, {
  font = "helvetica",
  style = "normal",
  size = 10,
  color = C.body,
  lineHeight = 1.6,
  maxWidth = CONTENT_W,
} = {}) {
  _pdf.setFont(font, style);
  _pdf.setFontSize(size);
  _pdf.setTextColor(...color);

  const leading = size * lineHeight;
  const lines = _pdf.splitTextToSize(text, maxWidth);

  for (const line of lines) {
    y = ensureSpace(y, leading);
    _pdf.text(line, x ?? MARGIN_X, y);
    y += leading;
  }
  return y;
}

/** Large section title with accent bar underneath. */
function sectionHeading(title, y) {
  y = ensureSpace(y, 45);
  y += 8;
  y = writeText(title.toUpperCase(), y, MARGIN_X, {
    style: "bold",
    size: 13,
    color: C.heading,
    lineHeight: 1.2,
  });
  y = drawAccentBar(y);
  return y;
}

/** Medium sub-heading for episodes, etc. */
function subHeading(text, y) {
  y = ensureSpace(y, 30);
  y = writeText(text, y, MARGIN_X, {
    style: "bold",
    size: 11.5,
    color: C.sub,
    lineHeight: 1.2,
  });
  return y + 6;
}

/** Small inline label above a block. */
function blockLabel(text, y) {
  y = ensureSpace(y, 20);
  y = writeText(text.toUpperCase(), y, MARGIN_X, {
    style: "bold",
    size: 8,
    color: C.label,
    lineHeight: 1.2,
  });
  return y + 2;
}

/** Body paragraph text. */
function bodyText(text, y, { indent = 0 } = {}) {
  return writeText(text, y, MARGIN_X + indent, {
    size: 10,
    color: C.body,
    lineHeight: 1.65,
    maxWidth: CONTENT_W - indent,
  });
}

/** Key-value on stacked lines: small label then normal value. */
function fieldStacked(label, value, y) {
  y = ensureSpace(y, 28);
  _pdf.setFont("helvetica", "bold");
  _pdf.setFontSize(8);
  _pdf.setTextColor(...C.label);
  _pdf.text(label.toUpperCase(), MARGIN_X, y);
  y += 12;
  y = bodyText(String(value ?? "—"), y);
  return y + 2;
}

/** Key: Value on a single line (for short values). */
function fieldInline(label, value, y, { labelWidth = 100 } = {}) {
  y = ensureSpace(y, 16);
  _pdf.setFont("helvetica", "bold");
  _pdf.setFontSize(9);
  _pdf.setTextColor(...C.label);
  _pdf.text(label, MARGIN_X, y);

  _pdf.setFont("helvetica", "normal");
  _pdf.setFontSize(10);
  _pdf.setTextColor(...C.body);
  _pdf.text(String(value ?? "—"), MARGIN_X + labelWidth, y);
  return y + 16;
}

/** Bullet list with proper wrapping. */
function bulletList(items, y, { indent = 8 } = {}) {
  _pdf.setFont("helvetica", "normal");
  _pdf.setFontSize(9.5);
  _pdf.setTextColor(...C.body);

  const bulletX = MARGIN_X + indent;
  const textX = bulletX + 10;
  const maxW = CONTENT_W - indent - 10;
  const leading = 14;

  for (const item of items) {
    const lines = _pdf.splitTextToSize(String(item), maxW);
    for (let i = 0; i < lines.length; i++) {
      y = ensureSpace(y, leading);
      if (i === 0) {
        _pdf.setFontSize(7);
        _pdf.text("\u2022", bulletX, y);
        _pdf.setFontSize(9.5);
      }
      _pdf.text(lines[i], textX, y);
      y += leading;
    }
    y += 2; // small gap between items
  }
  return y;
}

/** Draw a shaded score box inline. Returns x after the box. */
function scoreBox(label, value, x, y, width = 80) {
  _pdf.setFillColor(...C.bgLight);
  _pdf.roundedRect(x, y - 10, width, 30, 3, 3, "F");

  _pdf.setFont("helvetica", "normal");
  _pdf.setFontSize(7);
  _pdf.setTextColor(...C.muted);
  _pdf.text(label.toUpperCase(), x + width / 2, y - 1, { align: "center" });

  _pdf.setFont("helvetica", "bold");
  _pdf.setFontSize(14);
  _pdf.setTextColor(...C.heading);
  _pdf.text(String(value ?? "—"), x + width / 2, y + 14, { align: "center" });

  return x + width + 8;
}

/** Draw a row of score boxes. Returns y after the row. */
function scoreRow(scores, y) {
  // scores = [{ label, value }, ...]
  y = ensureSpace(y, 40);
  let x = MARGIN_X;
  const boxW = Math.min(100, (CONTENT_W - (scores.length - 1) * 8) / scores.length);
  for (const s of scores) {
    scoreBox(s.label, s.value, x, y, boxW);
    x += boxW + 8;
  }
  return y + 38;
}

// ─── Section renderers ──────────────────────────────────────────────────────

function renderCoverPage(data) {
  let y = PAGE_H * 0.28;

  y += 22;

  // Title
  y = writeText("Story Flow", y, MARGIN_X, {
    style: "bold",
    size: 32,
    color: C.heading,
    lineHeight: 1.1,
  });
  y = writeText("Results Report", y, MARGIN_X, {
    style: "normal",
    size: 20,
    color: C.muted,
    lineHeight: 1.2,
  });

  y += 24;

  // Story idea
  if (data.story_idea) {
    _pdf.setDrawColor(...C.rule);
    _pdf.setLineWidth(0.4);
    _pdf.line(MARGIN_X, y, MARGIN_X + CONTENT_W * 0.5, y);
    y += 16;

    y = writeText(`"${data.story_idea}"`, y, MARGIN_X, {
      style: "italic",
      size: 12,
      color: C.sub,
      lineHeight: 1.6,
      maxWidth: CONTENT_W * 0.75,
    });
  }

  y += 30;

  // Metadata fields
  const meta = [];
  if (data.run_id) meta.push(["Run ID", String(data.run_id)]);
  if (data.revisions_completed != null) meta.push(["Revisions", String(data.revisions_completed)]);
  if (data.created_at) meta.push(["Created", new Date(data.created_at).toLocaleString()]);

  for (const [label, value] of meta) {
    _pdf.setFont("helvetica", "bold");
    _pdf.setFontSize(8);
    _pdf.setTextColor(...C.label);
    _pdf.text(label.toUpperCase(), MARGIN_X, y);

    _pdf.setFont("helvetica", "normal");
    _pdf.setFontSize(10);
    _pdf.setTextColor(...C.body);
    _pdf.text(value, MARGIN_X + 80, y);
    y += 18;
  }
}

function renderEpisodeScripts(episodeScripts, y) {
  if (!episodeScripts) return y;
  const scripts = Array.isArray(episodeScripts.scripts) ? episodeScripts.scripts : [];
  if (scripts.length === 0) return y;

  y = sectionHeading("Episode Scripts", y);

  // Summary stats
  if (episodeScripts.total_word_count) {
    y = fieldInline("Total Words", episodeScripts.total_word_count.toLocaleString(), y);
  }
  if (episodeScripts.series_continuity_summary) {
    y = blockLabel("Series Continuity", y);
    y = bodyText(episodeScripts.series_continuity_summary, y, { indent: 0 });
    y += 8;
  }

  for (let i = 0; i < scripts.length; i++) {
    const script = scripts[i];

    // Episode heading with word count badge
    const title = `Episode ${script.episode_number} — ${script.title || "Untitled"}`;
    const wordNote = script.word_count ? `  (${script.word_count.toLocaleString()} words)` : "";
    y = subHeading(title, y);
    if (wordNote) {
      // Put word count on the line right after the subheading
      y = writeText(wordNote.trim(), y - 4, MARGIN_X, {
        size: 8,
        color: C.muted,
        lineHeight: 1,
      });
      y += 8;
    }

    // Script body — each paragraph with proper spacing
    const paragraphs = (script.script || "").split(/\n\n+/).filter(Boolean);
    for (const para of paragraphs) {
      y = bodyText(para.trim(), y);
      y += 8;
    }

    // Scene directions
    const directions = Array.isArray(script.scene_directions) ? script.scene_directions : [];
    if (directions.length > 0) {
      y += 4;
      y = blockLabel("Scene Directions", y);
      y = bulletList(directions, y);
    }

    // Continuity notes
    if (script.continuity_notes) {
      y += 4;
      y = blockLabel("Continuity Notes", y);
      y = bodyText(script.continuity_notes, y, { indent: 0 });
    }

    // Visual separator between episodes (not after the last one)
    y += 10;
    if (i < scripts.length - 1) {
      y = drawRule(y, { width: CONTENT_W * 0.4, color: C.rule });
      y += 4;
    }
  }

  return y;
}

function renderEpisodeTimeline(episodePlan, y) {
  if (!Array.isArray(episodePlan) || episodePlan.length === 0) return y;

  y = sectionHeading("Episode Timeline", y);

  for (const ep of episodePlan) {
    y = subHeading(`Episode ${ep.episode_number}`, y);

    if (ep.hook) {
      y = blockLabel("Hook", y);
      y = bodyText(ep.hook, y);
      y += 4;
    }

    const beats = Array.isArray(ep.beats) ? ep.beats : [];
    if (beats.length > 0) {
      y = blockLabel("Beats", y);
      y = bulletList(beats, y);
    }

    if (ep.cliffhanger) {
      y = blockLabel("Cliffhanger", y);
      y = bodyText(ep.cliffhanger, y);
    }

    y += 12;
  }

  return y;
}

function renderEmotionalArc(emotionalArc, y) {
  if (!emotionalArc || Object.keys(emotionalArc).length === 0) return y;

  y = sectionHeading("Emotional Arc", y);

  // Coherence as a score box
  if (typeof emotionalArc.coherence_score === "number") {
    y = scoreRow([{ label: "Coherence", value: emotionalArc.coherence_score.toFixed(1) }], y);
  }

  const beats = Array.isArray(emotionalArc.beats) ? emotionalArc.beats : [];
  if (beats.length > 0) {
    // Table-style: Episode | Emotion | Intensity
    y = ensureSpace(y, 20);

    // Table header
    const col1 = MARGIN_X;
    const col2 = MARGIN_X + 70;
    const col3 = MARGIN_X + CONTENT_W - 60;

    _pdf.setFont("helvetica", "bold");
    _pdf.setFontSize(8);
    _pdf.setTextColor(...C.label);
    _pdf.text("EPISODE", col1, y);
    _pdf.text("DOMINANT EMOTION", col2, y);
    _pdf.text("INTENSITY", col3, y);
    y += 6;
    y = drawRule(y, { weight: 0.3 });

    _pdf.setFont("helvetica", "normal");
    _pdf.setFontSize(10);
    for (const beat of beats) {
      if (typeof beat === "string") {
        y = bodyText(beat, y);
        y += 4;
        continue;
      }
      y = ensureSpace(y, 18);
      _pdf.setTextColor(...C.muted);
      _pdf.setFontSize(10);
      _pdf.text(String(beat.episode_number ?? "—"), col1, y);
      _pdf.setTextColor(...C.body);
      _pdf.text(beat.dominant_emotion || "—", col2, y);
      _pdf.setTextColor(...C.heading);
      _pdf.setFont("helvetica", "bold");
      _pdf.text(beat.intensity_score != null ? `${beat.intensity_score}/10` : "—", col3, y);
      _pdf.setFont("helvetica", "normal");
      y += 18;
    }
  }

  return y + 8;
}

function renderRetentionRisk(retentionAnalysis, y) {
  if (!retentionAnalysis || Object.keys(retentionAnalysis).length === 0) return y;

  y = sectionHeading("Retention Risk", y);

  // Overall risk as a highlighted field
  y = scoreRow([{ label: "Overall Risk", value: retentionAnalysis.overall_risk || "Unknown" }], y);

  const episodes = Array.isArray(retentionAnalysis.episodes) ? retentionAnalysis.episodes : [];
  for (const ep of episodes) {
    y = subHeading(`Episode ${ep.episode_number ?? "?"}`, y);

    const retention = Number.isFinite(Number(ep.retention_score)) ? Number(ep.retention_score) : 0;
    const risk = Math.max(0, Math.min(100, 100 - retention));

    // Inline scores
    y = scoreRow([
      { label: "Retention", value: `${retention}%` },
      { label: "Risk", value: `${risk}%` },
    ], y);

    if (ep.risk_zone) {
      y = blockLabel("Risk Zone", y);
      y = bodyText(ep.risk_zone, y);
      y += 4;
    }

    const fixes = Array.isArray(ep.suggested_fixes) ? ep.suggested_fixes : [];
    if (fixes.length > 0) {
      y = blockLabel("Suggested Fixes", y);
      y = bulletList(fixes, y);
    }

    y += 6;
  }

  return y;
}

function renderCliffhangers(cliffhangerAnalysis, y) {
  if (!cliffhangerAnalysis || Object.keys(cliffhangerAnalysis).length === 0) return y;

  y = sectionHeading("Cliffhanger Scores", y);

  if (typeof cliffhangerAnalysis.average_score === "number") {
    y = scoreRow([{ label: "Average", value: cliffhangerAnalysis.average_score.toFixed(1) }], y);
  }

  const episodes = Array.isArray(cliffhangerAnalysis.episodes) ? cliffhangerAnalysis.episodes : [];
  for (const ep of episodes) {
    y = subHeading(`Episode ${ep.episode_number ?? "?"}`, y);

    // Three scores side by side
    const scores = [];
    if (ep.curiosity_score != null) scores.push({ label: "Curiosity", value: ep.curiosity_score });
    if (ep.stakes_score != null) scores.push({ label: "Stakes", value: ep.stakes_score });
    if (ep.emotional_score != null) scores.push({ label: "Emotional", value: ep.emotional_score });
    if (scores.length > 0) {
      y = scoreRow(scores, y);
    }

    if (ep.explanation) {
      y = bodyText(ep.explanation, y);
    }

    y += 8;
  }

  return y;
}

function renderOptimizationReport(report, y) {
  if (!report || Object.keys(report).length === 0) return y;

  y = sectionHeading("Optimization Report", y);

  // Quality scores as boxes
  const scores = report.quality_scores || {};
  const scoreKeys = Object.keys(scores);
  if (scoreKeys.length > 0) {
    const boxes = scoreKeys.map((key) => ({
      label: key.replace(/_/g, " "),
      value: scores[key],
    }));
    y = scoreRow(boxes, y);
  }

  // Top priorities
  const priorities = Array.isArray(report.top_priorities) ? report.top_priorities : [];
  if (priorities.length > 0) {
    y = blockLabel("Top Priorities", y);
    y = bulletList(priorities, y);
    y += 6;
  }

  // Per-episode suggestions (grouped by episode)
  const suggestions = Array.isArray(report.per_episode_suggestions) ? report.per_episode_suggestions : [];
  if (suggestions.length > 0) {
    y = blockLabel("Episode Suggestions", y);

    // Group by episode_number
    const grouped = new Map();
    const order = [];
    for (const s of suggestions) {
      const epNum = s?.episode_number ?? null;
      const key = epNum != null ? epNum : "general";
      if (!grouped.has(key)) {
        grouped.set(key, { episodeNumber: epNum, items: [] });
        order.push(key);
      }
      grouped.get(key).items.push(s?.suggestion || "—");
    }

    // Sort: general (0 or null) first, then by episode number
    order.sort((a, b) => {
      const aNum = typeof a === "number" && a > 0 ? a : 0;
      const bNum = typeof b === "number" && b > 0 ? b : 0;
      return aNum - bNum;
    });

    for (const key of order) {
      const group = grouped.get(key);
      const label = (group.episodeNumber == null || group.episodeNumber === 0)
        ? "General"
        : `Episode ${group.episodeNumber}`;

      y = ensureSpace(y, 28);
      y = writeText(label, y, MARGIN_X, {
        style: "bold",
        size: 9,
        color: C.label,
        lineHeight: 1.2,
      });
      y += 2;
      y = bulletList(group.items, y);
      y += 4;
    }
  }

  return y;
}

// ─── Headers & Footers (stamped at the end) ─────────────────────────────────

function stampHeadersAndFooters(totalPages) {
  for (let i = 1; i <= totalPages; i++) {
    _pdf.setPage(i);

    // Footer: page number
    _pdf.setFont("helvetica", "normal");
    _pdf.setFontSize(8);
    _pdf.setTextColor(...C.muted);
    _pdf.text(`${i} / ${totalPages}`, PAGE_W / 2, PAGE_H - 24, { align: "center" });

    // Header on pages after the cover
    if (i > 1 && _storyTitle) {
      _pdf.setFont("helvetica", "normal");
      _pdf.setFontSize(7.5);
      _pdf.setTextColor(...C.muted);
      _pdf.text(_storyTitle, MARGIN_X, 32);
      _pdf.setDrawColor(...C.rule);
      _pdf.setLineWidth(0.3);
      _pdf.line(MARGIN_X, 38, PAGE_W - MARGIN_X, 38);
    }
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function generateStoryPdf(analysisData) {
  _pdf = new jsPDF("p", "pt", "a4");
  _storyTitle = analysisData?.story_idea
    ? `Story Flow — ${analysisData.story_idea.length > 60 ? analysisData.story_idea.slice(0, 60) + "..." : analysisData.story_idea}`
    : "Story Flow Results";

  // Page 1: Cover
  renderCoverPage(analysisData);

  // Content pages
  _pdf.addPage();
  let y = MARGIN_TOP;

  y = renderEpisodeScripts(analysisData.episode_scripts, y);
  y = renderEpisodeTimeline(analysisData.episode_plan, y);
  y = renderEmotionalArc(analysisData.emotional_arc, y);
  y = renderRetentionRisk(analysisData.retention_analysis, y);
  y = renderCliffhangers(analysisData.cliffhanger_analysis, y);
  y = renderOptimizationReport(analysisData.optimization_report, y);

  // Stamp headers and footers on all pages
  stampHeadersAndFooters(_pdf.internal.getNumberOfPages());

  // Save
  const filename = analysisData?.story_idea
    ? `story-flow-${analysisData.story_idea.slice(0, 30).replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "").toLowerCase()}.pdf`
    : "story-flow-results.pdf";

  _pdf.save(filename);
  _pdf = null;
}
