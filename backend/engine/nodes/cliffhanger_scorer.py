"""Node 4: Cliffhanger Strength Scoring Engine.

Evaluates each episode's cliffhanger on curiosity gap, stakes,
emotional charge, and type classification.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from engine.llm import get_model
from engine.prompts import CLIFFHANGER_SCORER_HUMAN, CLIFFHANGER_SCORER_SYSTEM
from engine.state import CliffhangerAnalysis, EpisodeEngineState


def cliffhanger_scorer_node(state: EpisodeEngineState) -> dict:
    """Score the cliffhanger strength of each episode."""
    model = get_model().with_structured_output(CliffhangerAnalysis)

    episode_plan = state["episode_plan"]
    episodes_json = episode_plan.model_dump_json(indent=2)

    messages = [
        SystemMessage(content=CLIFFHANGER_SCORER_SYSTEM),
        HumanMessage(
            content=CLIFFHANGER_SCORER_HUMAN.format(episodes_json=episodes_json)
        ),
    ]

    result: CliffhangerAnalysis = model.invoke(messages)

    return {"cliffhanger_analysis": result}
