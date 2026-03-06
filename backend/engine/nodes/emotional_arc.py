"""Node 2: Emotional Arc Analyzer.

Detects and maps the emotional progression across all episodes,
identifying emotion beats, intensity curves, and cross-episode coherence.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from engine.llm import get_model
from engine.prompts import EMOTIONAL_ARC_HUMAN, EMOTIONAL_ARC_SYSTEM
from engine.state import EmotionalArc, EpisodeEngineState


def emotional_arc_node(state: EpisodeEngineState) -> dict:
    """Analyse the emotional progression of the episode plan."""
    model = get_model().with_structured_output(EmotionalArc)

    episode_plan = state["episode_plan"]
    episodes_json = episode_plan.model_dump_json(indent=2)

    messages = [
        SystemMessage(content=EMOTIONAL_ARC_SYSTEM),
        HumanMessage(content=EMOTIONAL_ARC_HUMAN.format(episodes_json=episodes_json)),
    ]

    result: EmotionalArc = model.invoke(messages)

    return {"emotional_arc": result}
