"""Node A1: Story Expander.

Generates a detailed story description from the user's input, expanding it
into a semi-narrative form with characters, setting, and plot hooks
(300-600 words).
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from engine.llm import get_model
from engine.prompts import STORY_EXPANDER_HUMAN, STORY_EXPANDER_SYSTEM
from engine.state import EpisodeEngineState, ExpandedStory


def story_expander_node(state: EpisodeEngineState) -> dict:
    """Expand a brief story idea into a rich, detailed story description."""
    model = get_model().with_structured_output(ExpandedStory)

    input_cls = state["input_classification"]
    classification = input_cls.classification
    task = input_cls.preprocessed_input

    messages = [
        SystemMessage(content=STORY_EXPANDER_SYSTEM),
        HumanMessage(
            content=STORY_EXPANDER_HUMAN.format(
                task=task,
                classification=classification,
            )
        ),
    ]

    result: ExpandedStory = model.invoke(messages)

    return {"expanded_story": result}
