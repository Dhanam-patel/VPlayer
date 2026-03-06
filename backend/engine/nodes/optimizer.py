"""Node 5: Optimization Suggestion Engine.

Synthesises all analysis data (emotional arc, retention risk, cliffhanger
scores) and produces prioritized, actionable improvement suggestions.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from engine.llm import get_model
from engine.prompts import OPTIMIZER_HUMAN, OPTIMIZER_SYSTEM
from engine.state import EpisodeEngineState, OptimizationReport


def optimizer_node(state: EpisodeEngineState) -> dict:
    """Generate optimization suggestions based on all analysis results."""
    model = get_model().with_structured_output(OptimizationReport)

    episode_plan = state["episode_plan"]
    emotional_arc = state["emotional_arc"]
    retention_analysis = state["retention_analysis"]
    cliffhanger_analysis = state["cliffhanger_analysis"]

    messages = [
        SystemMessage(content=OPTIMIZER_SYSTEM),
        HumanMessage(
            content=OPTIMIZER_HUMAN.format(
                episodes_json=episode_plan.model_dump_json(indent=2),
                emotional_arc_json=emotional_arc.model_dump_json(indent=2),
                retention_json=retention_analysis.model_dump_json(indent=2),
                cliffhanger_json=cliffhanger_analysis.model_dump_json(indent=2),
            )
        ),
    ]

    result: OptimizationReport = model.invoke(messages)

    return {"optimization_report": result}
