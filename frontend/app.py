from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import requests
import streamlit as st

# ---------------------------------------------------------------------------
# Node display names and ordering for progress tracking
# ---------------------------------------------------------------------------

_NODE_LABELS: dict[str, str] = {
    "input_classifier": "Input Classifier",
    "story_expander": "Story Expander",
    "story_validator": "Story Validator",
    "episode_planner": "Episode Planner",
    "episode_scripter": "Episode Scripter",
    "emotional_arc_scorer": "Emotional Arc Scorer",
    "cliffhanger_strength_scorer": "Cliffhanger Strength Scorer",
    "retention_risk_analyzer": "Retention Risk Analyzer",
    "final_validator": "Final Validator",
    "optimizer": "Optimizer",
}

# Ordered list for progress calculation.
# A5 (emotional_arc_scorer) and A6 (cliffhanger_strength_scorer) run in
# parallel, but we still count them individually for progress purposes.
_NODE_ORDER: list[str] = [
    "input_classifier",
    "story_expander",
    "story_validator",
    "episode_planner",
    "episode_scripter",
    "emotional_arc_scorer",
    "cliffhanger_strength_scorer",
    "retention_risk_analyzer",
    "final_validator",
    "optimizer",
]


@dataclass
class ApiConfig:
    base_url: str
    timeout_seconds: int


# ---------------------------------------------------------------------------
# SSE streaming client
# ---------------------------------------------------------------------------


def stream_analysis(
    config: ApiConfig, payload: dict[str, Any]
) -> dict[str, Any] | None:
    """Call the streaming endpoint and render real-time progress.

    Returns the final analysis response dict, or None on error.
    """
    url = f"{config.base_url.rstrip('/')}/episodic-intelligence/analyze/stream"

    max_revisions = payload.get("max_revisions", 2)
    # A0-A2 run once (3 nodes), A3-A8+optimizer (7 nodes) can loop up to
    # max_revisions times via the A8 replan loop.
    once_nodes = 3  # input_classifier, story_expander, story_validator
    loop_nodes = 7  # episode_planner..optimizer
    total_nodes = once_nodes + loop_nodes * max_revisions

    completed_count = 0
    current_revision = 1
    final_result: dict[str, Any] | None = None

    # Accumulate thinking text per node so we can render it in expanders.
    thinking_buffers: dict[str, list[str]] = {}
    # Map of node key -> Streamlit container for live-updating thinking text.
    thinking_containers: dict[str, Any] = {}

    progress_bar = st.progress(0.0)

    with st.status(
        "Running episodic intelligence analysis...", expanded=True
    ) as status:
        try:
            with requests.post(
                url, json=payload, stream=True, timeout=config.timeout_seconds
            ) as resp:
                resp.raise_for_status()

                current_event: str | None = None

                for raw_line in resp.iter_lines(decode_unicode=True):
                    if raw_line is None:
                        continue
                    line = raw_line.strip()

                    if not line:
                        current_event = None
                        continue

                    if line.startswith("event:"):
                        current_event = line[len("event:") :].strip()
                        continue

                    if not line.startswith("data:"):
                        continue

                    data = json.loads(line[len("data:") :].strip())

                    if current_event == "progress":
                        node = data.get("node", "")
                        node_status = data.get("status", "")
                        label = _NODE_LABELS.get(node, node)

                        if node_status == "started":
                            st.write(f"Running **{label}**...")
                        elif node_status == "completed":
                            completed_count += 1
                            pct = min(completed_count / total_nodes, 1.0)
                            progress_bar.progress(pct)

                            # Detect revision boundary: when final_validator
                            # completes and triggers a replan, the next node
                            # will be episode_planner again.
                            if node == "final_validator":
                                if current_revision < max_revisions:
                                    current_revision += 1
                                    st.write(
                                        f"--- Revision {current_revision}"
                                        f"/{max_revisions} ---"
                                    )

                    elif current_event == "thinking":
                        node = data.get("node", "unknown")
                        text = data.get("text", "")
                        if text:
                            label = _NODE_LABELS.get(node, node)
                            key = f"{node}_{current_revision}"

                            if key not in thinking_buffers:
                                thinking_buffers[key] = []
                                # Create an expander for this node's thinking.
                                expander = st.expander(
                                    f"Thinking: {label}", expanded=True
                                )
                                thinking_containers[key] = expander.empty()

                            thinking_buffers[key].append(text)
                            # Update the container with all accumulated text.
                            thinking_containers[key].code(
                                "".join(thinking_buffers[key]),
                                language=None,
                            )

                    elif current_event == "complete":
                        final_result = data

                    elif current_event == "error":
                        st.error(data.get("detail", "Unknown pipeline error."))
                        status.update(
                            label="Analysis failed", state="error", expanded=True
                        )
                        progress_bar.empty()
                        return None

        except requests.ConnectionError:
            st.error(
                f"Could not connect to backend at {config.base_url}. "
                "Is the server running?"
            )
            status.update(label="Connection failed", state="error", expanded=True)
            progress_bar.empty()
            return None
        except requests.HTTPError as exc:
            st.error(f"Backend returned HTTP {exc.response.status_code}.")
            status.update(label="Analysis failed", state="error", expanded=True)
            progress_bar.empty()
            return None
        except requests.Timeout:
            st.error(
                f"Request timed out after {config.timeout_seconds}s. "
                "Try increasing the timeout in the sidebar."
            )
            status.update(label="Timed out", state="error", expanded=True)
            progress_bar.empty()
            return None

        progress_bar.progress(1.0)
        status.update(label="Analysis complete!", state="complete", expanded=False)

    return final_result


# ---------------------------------------------------------------------------
# Render helpers — consume the agent's native Pydantic model output
# ---------------------------------------------------------------------------


def render_story(data: dict[str, Any]) -> None:
    """Render the final episodic story — clean narrative text only."""
    st.subheader("The Story")
    scripts_data = data.get("episode_scripts", {})
    if not scripts_data:
        st.info("No story data available.")
        return

    scripts = sorted(
        scripts_data.get("scripts", []),
        key=lambda s: s["episode_number"],
    )
    if not scripts:
        st.info("No story data available.")
        return

    for i, s in enumerate(scripts):
        ep_num = s["episode_number"]
        title = s.get("title", f"Episode {ep_num}")
        st.markdown(f"#### Episode {ep_num}: {title}")
        st.markdown(s["script"])
        if i < len(scripts) - 1:
            st.divider()


def render_episode_plan(data: dict[str, Any]) -> None:
    st.subheader("Episode Plan")
    plan = data.get("episode_planner", {})
    if not plan:
        st.info("No episode plan data.")
        return

    # Series-level info
    st.markdown(
        f"**Narrative Arc:** {plan.get('overall_narrative_arc', 'N/A')}  \n"
        f"**Target Audience:** {plan.get('target_audience', 'N/A')}  \n"
        f"**Total Episodes:** {plan.get('total_episodes', 'N/A')}"
    )

    for ep in plan.get("episodes", []):
        with st.expander(
            f"Episode {ep['episode_number']}: {ep['title']}", expanded=False
        ):
            st.write(f"**Outline:** {ep['outline']}")
            st.write(f"**Emotional Arc Notes:** {ep['emotional_arc_notes']}")
            st.write(f"**Cliffhanger Idea:** {ep['cliffhanger_idea']}")
            st.write("**Retention Hooks:**")
            for hook in ep.get("retention_hooks", []):
                st.write(f"- {hook}")
            st.caption(f"Target word count: {ep.get('estimated_word_count', 225)}")


def render_episode_scripts(data: dict[str, Any]) -> None:
    """Render episode scripts individually, each in its own expander."""
    st.subheader("Episode Scripts")
    scripts_data = data.get("episode_scripts", {})
    if not scripts_data:
        st.info("No script data available.")
        return

    scripts = sorted(
        scripts_data.get("scripts", []),
        key=lambda s: s["episode_number"],
    )
    if not scripts:
        st.info("No script data available.")
        return

    for s in scripts:
        ep_num = s["episode_number"]
        title = s.get("title", f"Episode {ep_num}")
        word_count = s.get("word_count", "N/A")
        with st.expander(
            f"Episode {ep_num}: {title} ({word_count} words)", expanded=False
        ):
            st.markdown(s["script"])

            directions = s.get("scene_directions", [])
            if directions:
                st.markdown("**Scene Directions:**")
                for d in directions:
                    st.write(f"- {d}")

            notes = s.get("continuity_notes", "")
            if notes:
                st.caption(f"Continuity: {notes}")

    st.caption(
        f"Total words: {scripts_data.get('total_word_count', 'N/A')} | "
        f"Continuity: {scripts_data.get('series_continuity_summary', 'N/A')}"
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

    response = stream_analysis(config, payload)

    if response is None:
        return

    st.success(f"Analysis complete. Run ID: {response.get('run_id', 'n/a')}")

    render_story(response)
    render_engagement_summary(response)
    render_episode_plan(response)
    render_episode_scripts(response)
    render_emotion_progression(response)
    render_cliffhanger_scores(response)
    render_retention_risk(response)
    render_optimizations(response)


if __name__ == "__main__":
    main()
