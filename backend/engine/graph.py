"""LangGraph graph builder for the Episodic Intelligence Engine.

Topology (parallel fan-out for analysis nodes):

                        ┌─> emotional_arc ──────┐
    START -> story_decomposer ──┼─> retention_risk ──────┼──> optimizer -> [should_continue]
                        └─> cliffhanger_scorer ─┘           |
                                                  +---------+----------+
                                                  |                    |
                                           story_decomposer          END
                                           (re-optimize)            (done)

The three analysis nodes (emotional_arc, retention_risk, cliffhanger_scorer)
run in parallel within the same LangGraph superstep, cutting wall-clock time
from ~4.5 min (sequential) to ~1.5 min (parallel) per pass.
"""

from __future__ import annotations

from typing import Literal

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from engine.nodes.cliffhanger_scorer import cliffhanger_scorer_node
from engine.nodes.emotional_arc import emotional_arc_node
from engine.nodes.optimizer import optimizer_node
from engine.nodes.retention_risk import retention_risk_node
from engine.nodes.story_decomposer import story_decomposer_node
from engine.state import EpisodeEngineState


def _should_continue(
    state: EpisodeEngineState,
) -> Literal["story_decomposer", "__end__"]:
    """Decide whether to loop back for another revision or finish.

    The loop exits when revision_number exceeds max_revisions.
    Since story_decomposer increments revision_number, by the time we
    reach this check, revision_number is already at (pass_count + 1).
    """
    if state.get("revision_number", 1) > state.get("max_revisions", 2):
        return "__end__"
    return "story_decomposer"


def build_graph(checkpointer: InMemorySaver | None = None) -> CompiledStateGraph:
    """Construct and compile the Episodic Intelligence Engine graph.

    Args:
        checkpointer: Optional checkpointer for state persistence.
            Defaults to an InMemorySaver if not provided.

    Returns:
        The compiled LangGraph graph, ready for .invoke() or .stream().
    """
    if checkpointer is None:
        checkpointer = InMemorySaver()

    builder = StateGraph(EpisodeEngineState)

    # --- Register nodes ---
    builder.add_node("story_decomposer", story_decomposer_node)
    builder.add_node("emotional_arc", emotional_arc_node)
    builder.add_node("retention_risk", retention_risk_node)
    builder.add_node("cliffhanger_scorer", cliffhanger_scorer_node)
    builder.add_node("optimizer", optimizer_node)

    # --- Entry edge ---
    builder.add_edge(START, "story_decomposer")

    # --- Parallel fan-out: story_decomposer -> 3 analysis nodes ---
    builder.add_edge("story_decomposer", "emotional_arc")
    builder.add_edge("story_decomposer", "retention_risk")
    builder.add_edge("story_decomposer", "cliffhanger_scorer")

    # --- Parallel fan-in: 3 analysis nodes -> optimizer ---
    builder.add_edge("emotional_arc", "optimizer")
    builder.add_edge("retention_risk", "optimizer")
    builder.add_edge("cliffhanger_scorer", "optimizer")

    # --- Conditional edge (optimization loop or end) ---
    builder.add_conditional_edges(
        "optimizer",
        _should_continue,
        {
            "story_decomposer": "story_decomposer",
            "__end__": END,
        },
    )

    # --- Compile ---
    graph = builder.compile(checkpointer=checkpointer)

    return graph
