from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from urllib import error, request

import streamlit as st


@dataclass
class ApiConfig:
    base_url: str
    timeout_seconds: int


def call_analysis_api(config: ApiConfig, payload: dict[str, Any]) -> dict[str, Any]:
    endpoint = f"{config.base_url.rstrip('/')}/episodic-intelligence/analyze"
    body = json.dumps(payload).encode("utf-8")

    req = request.Request(
        endpoint,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=config.timeout_seconds) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw)
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8") if exc.fp else exc.reason
        raise RuntimeError(f"HTTP {exc.code}: {details}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Could not connect to backend: {exc.reason}") from exc


# ---------------------------------------------------------------------------
# Render helpers — consume the agent's native Pydantic model output
# ---------------------------------------------------------------------------


def render_episode_plan(data: dict[str, Any]) -> None:
    st.subheader("Episode Arc")
    plan = data.get("episode_plan", {})
    if not plan:
        st.info("No episode plan data.")
        return

    # Series-level info
    st.markdown(
        f"**Theme:** {plan.get('overall_theme', 'N/A')}  \n"
        f"**Narrative Arc:** {plan.get('narrative_arc_type', 'N/A')}  \n"
        f"**Target Audience:** {plan.get('target_audience', 'N/A')}  \n"
        f"**Total Episodes:** {plan.get('total_episodes', 'N/A')}"
    )

    for ep in plan.get("episodes", []):
        with st.expander(
            f"Episode {ep['episode_number']}: {ep['title']}", expanded=False
        ):
            st.write(f"**Hook:** {ep['hook']}")
            st.write(f"**Core Conflict:** {ep['core_conflict']}")
            st.write("**Key Beats:**")
            for beat in ep.get("key_beats", []):
                st.write(f"- {beat}")
            st.write(f"**Cliffhanger:** {ep['cliffhanger']}")
            st.write(f"**Summary:** {ep['summary']}")
            st.caption(
                f"Estimated duration: {ep.get('estimated_duration_seconds', 90)}s"
            )


def render_emotion_progression(data: dict[str, Any]) -> None:
    st.subheader("Emotional Progression")
    arc = data.get("emotional_arc", {})
    if not arc:
        st.info("No emotional arc data.")
        return

    episodes = arc.get("episodes", [])
    if not episodes:
        st.info("No per-episode emotion data.")
        return

    # Chart: dominant emotion intensity per episode (use max intensity from beats)
    chart_data = {
        "episode": [e["episode_number"] for e in episodes],
        "emotional_range": [e.get("emotional_range", 0) for e in episodes],
    }
    st.line_chart(chart_data, x="episode", y="emotional_range")

    for ep in episodes:
        with st.expander(
            f"Episode {ep['episode_number']}: {ep.get('dominant_emotion', 'N/A')}",
            expanded=False,
        ):
            st.write(f"**Dominant Emotion:** {ep['dominant_emotion']}")
            st.write(f"**Emotional Range:** {ep['emotional_range']}/10")
            for beat in ep.get("emotion_beats", []):
                st.caption(
                    f"`{beat['timestamp_range']}` — {beat['emotion']} "
                    f"(intensity {beat['intensity']}/10)"
                )

    # Series-level
    st.markdown(f"**Overall Progression:** {arc.get('overall_progression', 'N/A')}")
    st.markdown(
        f"**Coherence Score:** {arc.get('emotional_coherence_score', 'N/A')}/10"
    )
    st.markdown(f"**Tension Curve:** {arc.get('tension_curve_description', 'N/A')}")


def render_cliffhanger_scores(data: dict[str, Any]) -> None:
    st.subheader("Cliffhanger Strength")
    analysis = data.get("cliffhanger_analysis", {})
    if not analysis:
        st.info("No cliffhanger data.")
        return

    scores = analysis.get("scores", [])
    if not scores:
        st.info("No cliffhanger scores.")
        return

    st.bar_chart(
        {
            "episode": [s["episode_number"] for s in scores],
            "score": [s["score"] for s in scores],
        },
        x="episode",
        y="score",
    )

    for s in scores:
        st.write(
            f"Episode {s['episode_number']}: **{s['score']}/10** "
            f"({s.get('cliffhanger_type', 'N/A')})"
        )
        st.caption(
            f"Curiosity gap: {s.get('curiosity_gap', 'N/A')}/10 | "
            f"Stakes: {s.get('stakes_level', 'N/A')}/10 | "
            f"Emotional charge: {s.get('emotional_charge', 'N/A')}/10"
        )
        st.caption(s.get("reasoning", ""))

    st.markdown(
        f"**Average Score:** {analysis.get('average_score', 'N/A')}/10  \n"
        f"**Strongest:** Episode {analysis.get('strongest_cliffhanger', 'N/A')}  \n"
        f"**Weakest:** Episode {analysis.get('weakest_cliffhanger', 'N/A')}"
    )


def render_retention_risk(data: dict[str, Any]) -> None:
    st.subheader("Retention Risk")
    analysis = data.get("retention_analysis", {})
    if not analysis:
        st.info("No retention data.")
        return

    episodes = analysis.get("episodes", [])
    for item in episodes:
        retention_pct = item.get("overall_retention_score", 0) / 100.0
        st.markdown(
            f"**Episode {item['episode_number']}** — "
            f"Retention: {item.get('overall_retention_score', 'N/A')}/100 | "
            f"Hook: {item.get('hook_strength', 'N/A')}/10 | "
            f"Pacing: {item.get('pacing_score', 'N/A')}/10"
        )
        st.progress(min(max(retention_pct, 0.0), 1.0))
        for zone in item.get("risk_zones", []):
            st.caption(
                f"`{zone['timestamp_range']}` [{zone['risk_level'].upper()}] "
                f"{zone['reason']}"
            )
            st.caption(f"  Fix: {zone.get('suggested_fix', 'N/A')}")

    st.markdown(
        f"**Strongest Episode:** {analysis.get('strongest_episode', 'N/A')}  \n"
        f"**Weakest Episode:** {analysis.get('weakest_episode', 'N/A')}  \n"
        f"**Series Retention Prediction:** "
        f"{analysis.get('overall_series_retention_prediction', 'N/A')}"
    )


def render_optimizations(data: dict[str, Any]) -> None:
    st.subheader("Optimization Suggestions")
    report = data.get("optimization_report", {})
    if not report:
        st.info("No optimization data.")
        return

    # Top 3 priorities
    top_3 = report.get("top_3_priorities", [])
    if top_3:
        st.markdown("**Top 3 Priorities:**")
        for i, p in enumerate(top_3, 1):
            st.write(f"{i}. {p}")

    st.markdown(
        f"**Current Quality:** {report.get('overall_quality_score', 'N/A')}/100  \n"
        f"**Predicted After Optimization:** "
        f"{report.get('predicted_quality_after_optimization', 'N/A')}/100"
    )

    suggestions = report.get("suggestions", [])
    if not suggestions:
        st.info("No suggestions generated.")
        return

    for tip in suggestions:
        ep_label = (
            f"Episode {tip['episode_number']}"
            if tip.get("episode_number", 0) > 0
            else "Series-wide"
        )
        priority = tip.get("priority", "medium").upper()
        st.write(
            f"[{priority}] {ep_label} — **{tip.get('category', 'N/A')}**: "
            f"{tip.get('current_issue', '')}"
        )
        st.caption(
            f"Suggestion: {tip.get('suggested_improvement', '')}  \n"
            f"Impact: {tip.get('expected_impact', '')}"
        )


def render_engagement_summary(data: dict[str, Any]) -> None:
    """Render a top-level summary from the available analysis data."""
    optimization = data.get("optimization_report", {})
    cliffhanger = data.get("cliffhanger_analysis", {})
    retention = data.get("retention_analysis", {})

    if not any([optimization, cliffhanger, retention]):
        return

    st.subheader("Engagement Summary")
    c1, c2, c3, c4 = st.columns(4)

    c1.metric(
        "Quality Score",
        f"{optimization.get('overall_quality_score', 'N/A')}/100",
    )
    c2.metric(
        "Avg Cliffhanger",
        f"{cliffhanger.get('average_score', 'N/A')}/10",
    )
    c3.metric(
        "Strongest Episode",
        retention.get("strongest_episode", "-"),
    )
    c4.metric(
        "Weakest Episode",
        retention.get("weakest_episode", "-"),
    )

    st.info(
        f"Revisions completed: {data.get('revisions_completed', 'N/A')} | "
        f"Series retention prediction: "
        f"{retention.get('overall_series_retention_prediction', 'N/A')}"
    )


def main() -> None:
    st.set_page_config(page_title="Episodic Intelligence Engine", layout="wide")
    st.title("AI-powered Episodic Intelligence Engine")
    st.caption(
        "Design, analyze, and optimize vertical multi-part stories in 90-second format."
    )

    with st.sidebar:
        st.header("Backend")
        base_url = st.text_input("API Base URL", value="http://localhost:8000")
        timeout_seconds = st.slider(
            "Timeout (seconds)", min_value=30, max_value=300, value=180
        )

    with st.form("story_form"):
        story_idea = st.text_area(
            "Story Idea",
            value=(
                "A college student starts receiving voice notes from her future self, "
                "warning her about a friend who will betray her in 48 hours."
            ),
            height=120,
        )
        col1, col2, col3, col4 = st.columns(4)
        genre = col1.text_input("Genre", value="thriller")
        target_audience = col2.text_input("Audience", value="18-30 mobile viewers")
        tone = col3.text_input("Tone", value="tense")
        episode_count = col4.slider("Episodes", min_value=5, max_value=8, value=6)

        submitted = st.form_submit_button("Analyze Story")

    if not submitted:
        st.info(
            "Submit a story idea to generate an episodic plan and engagement insights."
        )
        return

    payload = {
        "story_idea": story_idea,
        "genre": genre,
        "target_audience": target_audience,
        "tone": tone,
        "episode_count_preference": episode_count,
    }

    config = ApiConfig(base_url=base_url, timeout_seconds=timeout_seconds)

    with st.spinner(
        "Running episodic intelligence analysis (this may take 1-3 minutes)..."
    ):
        try:
            response = call_analysis_api(config, payload)
        except RuntimeError as exc:
            st.error(str(exc))
            return

    st.success(f"Analysis complete. Run ID: {response.get('run_id', 'n/a')}")

    render_engagement_summary(response)
    render_episode_plan(response)
    render_emotion_progression(response)
    render_cliffhanger_scores(response)
    render_retention_risk(response)
    render_optimizations(response)


if __name__ == "__main__":
    main()
