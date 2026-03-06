"""Node A0: Input Classifier.

Verifies whether the user input is a concise one-liner idea or a more
detailed story outline, classifying it to guide subsequent processing.
"""

from __future__ import annotations

from engine.state import EpisodeEngineState, InputClassification

# Threshold: inputs with fewer words are treated as a one-liner idea.
_ONE_LINER_WORD_LIMIT = 50


def input_classifier_node(state: EpisodeEngineState) -> dict:
    """Classify user input as a one-liner idea or a detailed story outline.

    Uses a simple word-count heuristic:
    - < 50 words  → "one-liner"
    - >= 50 words → "story"
    """
    raw_input = state["task"].strip()
    word_count = len(raw_input.split())

    classification = "one-liner" if word_count < _ONE_LINER_WORD_LIMIT else "story"

    result = InputClassification(
        classification=classification,
        preprocessed_input=raw_input,
        word_count=word_count,
    )

    return {"input_classification": result}
