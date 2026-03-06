"""Node 3: Retention Risk Predictor.

Predicts viewer drop-off zones within each 90-second episode and across
the series, scoring hook strength, pacing, and overall retention.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from engine.llm import get_model
from engine.prompts import RETENTION_RISK_HUMAN, RETENTION_RISK_SYSTEM
from engine.state import EpisodeEngineState, RetentionAnalysis


def retention_risk_node(state: EpisodeEngineState) -> dict:
    """Predict retention risk and drop-off zones for each episode."""
    model = get_model().with_structured_output(RetentionAnalysis)

    episode_plan = state["episode_plan"]
    episodes_json = episode_plan.model_dump_json(indent=2)

    messages = [
        SystemMessage(content=RETENTION_RISK_SYSTEM),
        HumanMessage(
            content=RETENTION_RISK_HUMAN.format(
                episodes_json=episodes_json,
            )
        ),
    ]

    result: RetentionAnalysis = model.invoke(messages)

    return {"retention_analysis": result}
