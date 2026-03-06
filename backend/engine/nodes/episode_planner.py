"""Node A3: Episode Planner.

Generates a structured episode planner for the full story, breaking it into
5-8 episodes with outlines, emotional arcs, cliffhanger ideas, and retention
hooks per episode, tailored for 90-second vertical format.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from engine.llm import get_model
from engine.prompts import EPISODE_PLANNER_HUMAN, EPISODE_PLANNER_SYSTEM
from engine.state import EpisodeEngineState, EpisodePlanner


def episode_planner_node(state: EpisodeEngineState) -> dict:
    """Create a structured per-episode planner from the expanded story."""
    model = get_model().with_structured_output(EpisodePlanner)

    expanded_story = state["expanded_story"]
    story_text = expanded_story.model_dump_json(indent=2)

    messages = [
        SystemMessage(content=EPISODE_PLANNER_SYSTEM),
        HumanMessage(
            content=EPISODE_PLANNER_HUMAN.format(expanded_story=story_text)
        ),
    ]

    result: EpisodePlanner = model.invoke(messages)

    return {"episode_planner": result}
