"""Node 1: Story Decomposer Engine.

Takes a raw story idea and breaks it into a structured 5-8 episode arc,
each designed for 90-second vertical video format.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from engine.llm import get_model
from engine.prompts import (
    STORY_DECOMPOSER_HUMAN,
    STORY_DECOMPOSER_REVISION_HUMAN,
    STORY_DECOMPOSER_SYSTEM,
)
from engine.state import EpisodeEngineState, EpisodePlan


def story_decomposer_node(state: EpisodeEngineState) -> dict:
    """Decompose a story idea into a structured multi-episode plan.

    On the first pass, generates a fresh episode plan from the story idea.
    On subsequent passes (revision loops), incorporates optimization
    suggestions to refine the plan.
    """
    model = get_model().with_structured_output(EpisodePlan)

    # Decide which human prompt to use based on whether we have suggestions
    optimization_report = state.get("optimization_report")
    if optimization_report is not None and state.get("revision_number", 1) > 1:
        suggestions_text = "\n".join(
            f"- [{s.priority.upper()}] Episode {s.episode_number} ({s.category}): "
            f"{s.current_issue} -> {s.suggested_improvement}"
            for s in optimization_report.suggestions
        )
        human_content = STORY_DECOMPOSER_REVISION_HUMAN.format(
            task=state["task"],
            optimization_suggestions=suggestions_text,
        )
    else:
        human_content = STORY_DECOMPOSER_HUMAN.format(task=state["task"])

    messages = [
        SystemMessage(content=STORY_DECOMPOSER_SYSTEM),
        HumanMessage(content=human_content),
    ]

    result: EpisodePlan = model.invoke(messages)

    return {
        "episode_plan": result,
        "revision_number": state.get("revision_number", 1) + 1,
    }
