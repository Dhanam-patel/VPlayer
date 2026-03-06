"""LangGraph nodes for the Episodic Intelligence Engine pipeline."""

from engine.nodes.story_decomposer import story_decomposer_node
from engine.nodes.emotional_arc import emotional_arc_node
from engine.nodes.retention_risk import retention_risk_node
from engine.nodes.cliffhanger_scorer import cliffhanger_scorer_node
from engine.nodes.optimizer import optimizer_node

# --- New pipeline nodes (A0–A7) ---
from engine.nodes.input_classifier import input_classifier_node
from engine.nodes.story_expander import story_expander_node
from engine.nodes.episode_planner import episode_planner_node
from engine.nodes.episode_scripter import episode_scripter_node
from engine.nodes.emotional_arc_scorer import emotional_arc_scorer_node
from engine.nodes.cliffhanger_strength_scorer import cliffhanger_strength_scorer_node
from engine.nodes.retention_risk_analyzer import retention_risk_analyzer_node

__all__ = [
    # Existing nodes
    "story_decomposer_node",
    "emotional_arc_node",
    "retention_risk_node",
    "cliffhanger_scorer_node",
    "optimizer_node",
    # New nodes (A0–A7)
    "input_classifier_node",
    "story_expander_node",
    "episode_planner_node",
    "episode_scripter_node",
    "emotional_arc_scorer_node",
    "cliffhanger_strength_scorer_node",
    "retention_risk_analyzer_node",
]
