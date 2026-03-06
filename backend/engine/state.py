"""State schema and Pydantic models for the Episodic Intelligence Engine."""

from __future__ import annotations

import operator
from typing import Annotated, Literal

from pydantic import BaseModel, Field
from typing_extensions import TypedDict


# ---------------------------------------------------------------------------
# Pydantic models — used for structured LLM output
# ---------------------------------------------------------------------------


class Episode(BaseModel):
    """A single episode in the multi-part story arc."""

    episode_number: int = Field(description="Episode number (1-based)")
    title: str = Field(description="Short, punchy episode title")
    hook: str = Field(
        description="Opening hook for the first 3 seconds to grab attention"
    )
    core_conflict: str = Field(
        description="The central tension or conflict within this episode"
    )
    key_beats: list[str] = Field(
        description="3-5 key story beats that happen in this 90-second episode"
    )
    cliffhanger: str = Field(
        description="The cliffhanger ending that compels viewers to watch the next episode"
    )
    estimated_duration_seconds: int = Field(
        default=90, description="Target duration in seconds (should be ~90)"
    )
    summary: str = Field(
        description="One-paragraph summary of the full episode content"
    )


class EpisodePlan(BaseModel):
    """Complete episode breakdown for the story idea."""

    overall_theme: str = Field(description="The overarching theme of the story")
    narrative_arc_type: str = Field(
        description="Type of narrative arc (e.g. Hero's Journey, Mystery/Reveal, Redemption, Survival, etc.)"
    )
    target_audience: str = Field(description="Intended audience for this content")
    total_episodes: int = Field(description="Total number of episodes (5-8)")
    episodes: list[Episode] = Field(description="The ordered list of episodes")


# --- Emotional Arc models ---


class EmotionBeat(BaseModel):
    """A single emotional beat within an episode."""

    timestamp_range: str = Field(
        description="Approximate time range within the 90s episode (e.g. '0-15s', '45-60s')"
    )
    emotion: str = Field(
        description="Primary emotion at this beat (e.g. curiosity, fear, hope, shock, sadness)"
    )
    intensity: int = Field(description="Emotion intensity on a 1-10 scale", ge=1, le=10)


class EpisodeEmotionProfile(BaseModel):
    """Emotional profile for a single episode."""

    episode_number: int
    emotion_beats: list[EmotionBeat] = Field(
        description="Sequence of emotional beats through the episode"
    )
    dominant_emotion: str = Field(
        description="The single most prominent emotion in this episode"
    )
    emotional_range: int = Field(
        description="How wide the emotional range is (1=flat, 10=extreme swings)",
        ge=1,
        le=10,
    )


class EmotionalArc(BaseModel):
    """Full emotional arc analysis across all episodes."""

    episodes: list[EpisodeEmotionProfile] = Field(
        description="Per-episode emotional profiles"
    )
    overall_progression: str = Field(
        description="Narrative description of how emotions progress across the full arc"
    )
    emotional_coherence_score: int = Field(
        description="How well emotions flow between episodes (1-10)", ge=1, le=10
    )
    tension_curve_description: str = Field(
        description="Description of the overall tension curve shape"
    )


# --- Retention Risk models ---


class RiskZone(BaseModel):
    """A specific zone within an episode where viewer drop-off is likely."""

    timestamp_range: str = Field(
        description="Time range where drop-off risk exists (e.g. '20-35s')"
    )
    risk_level: Literal["low", "medium", "high", "critical"] = Field(
        description="Severity of the retention risk"
    )
    reason: str = Field(description="Why viewers might drop off at this point")
    suggested_fix: str = Field(
        description="Quick suggestion to mitigate this risk zone"
    )


class EpisodeRetentionRisk(BaseModel):
    """Retention risk analysis for a single episode."""

    episode_number: int
    overall_retention_score: int = Field(
        description="Predicted retention score 0-100 (100=everyone stays)", ge=0, le=100
    )
    risk_zones: list[RiskZone] = Field(
        description="Specific time ranges with drop-off risk"
    )
    hook_strength: int = Field(
        description="How strong the opening hook is (1-10)", ge=1, le=10
    )
    pacing_score: int = Field(
        description="How well-paced the episode is (1-10)", ge=1, le=10
    )


class RetentionAnalysis(BaseModel):
    """Full retention risk analysis across all episodes."""

    episodes: list[EpisodeRetentionRisk] = Field(
        description="Per-episode retention analysis"
    )
    weakest_episode: int = Field(
        description="Episode number with the lowest retention score"
    )
    strongest_episode: int = Field(
        description="Episode number with the highest retention score"
    )
    overall_series_retention_prediction: str = Field(
        description="Prediction of how many viewers who start ep 1 will finish the series"
    )


# --- Cliffhanger models ---


class CliffhangerScore(BaseModel):
    """Cliffhanger quality assessment for a single episode."""

    episode_number: int
    score: int = Field(description="Cliffhanger strength score (1-10)", ge=1, le=10)
    cliffhanger_type: str = Field(
        description="Type of cliffhanger (e.g. Question, Danger, Revelation, Emotional, Decision, Twist)"
    )
    curiosity_gap: int = Field(
        description="How strong the curiosity gap is (1-10)", ge=1, le=10
    )
    stakes_level: int = Field(
        description="How high the stakes feel (1-10)", ge=1, le=10
    )
    emotional_charge: int = Field(
        description="Emotional impact of the cliffhanger (1-10)", ge=1, le=10
    )
    reasoning: str = Field(
        description="Explanation of why this cliffhanger works or doesn't"
    )


class CliffhangerAnalysis(BaseModel):
    """Full cliffhanger analysis across all episodes."""

    scores: list[CliffhangerScore] = Field(description="Per-episode cliffhanger scores")
    average_score: float = Field(
        description="Average cliffhanger score across all episodes"
    )
    weakest_cliffhanger: int = Field(
        description="Episode number with the weakest cliffhanger"
    )
    strongest_cliffhanger: int = Field(
        description="Episode number with the strongest cliffhanger"
    )


# --- Optimization models ---


class Suggestion(BaseModel):
    """A single optimization suggestion."""

    episode_number: int = Field(
        description="Which episode this applies to (0 = series-wide)"
    )
    category: Literal[
        "hook", "pacing", "cliffhanger", "emotion", "structure", "dialogue"
    ] = Field(description="Category of improvement")
    current_issue: str = Field(description="What the current problem is")
    suggested_improvement: str = Field(description="Specific, actionable improvement")
    priority: Literal["critical", "high", "medium", "low"] = Field(
        description="Priority level for this fix"
    )
    expected_impact: str = Field(
        description="What impact this change would have on viewer engagement"
    )


class OptimizationReport(BaseModel):
    """Full set of optimization suggestions."""

    suggestions: list[Suggestion] = Field(description="All improvement suggestions")
    top_3_priorities: list[str] = Field(
        description="The 3 most impactful changes to make, in plain language"
    )
    overall_quality_score: int = Field(
        description="Current overall quality score for the series (1-100)", ge=1, le=100
    )
    predicted_quality_after_optimization: int = Field(
        description="Predicted quality score if all suggestions are applied (1-100)",
        ge=1,
        le=100,
    )


# ---------------------------------------------------------------------------
# LangGraph State — the TypedDict that flows through the graph
# ---------------------------------------------------------------------------


class EpisodeEngineState(TypedDict):
    """Central state object passed between all LangGraph nodes."""

    # Input
    task: str  # The user's raw story idea

    # Node outputs
    episode_plan: EpisodePlan | None
    emotional_arc: EmotionalArc | None
    retention_analysis: RetentionAnalysis | None
    cliffhanger_analysis: CliffhangerAnalysis | None
    optimization_report: OptimizationReport | None

    # Loop control
    revision_number: int
    max_revisions: int
