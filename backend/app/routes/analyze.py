"""POST /episodic-intelligence/analyze — run the LangGraph agent and return structured results."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AnalysisRun
from app.schemas import AnalyzeRequest, AnalyzeResponse
from engine.graph import build_graph

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/episodic-intelligence", tags=["analysis"])

# Build the graph once at module level (stateless; state lives in the checkpointer).
_graph = build_graph()


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_story(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
) -> AnalyzeResponse:
    """Run the Episodic Intelligence Engine on a story idea.

    This is a synchronous endpoint — it blocks until the full LangGraph
    pipeline (decompose -> analyse x3 in parallel -> optimise -> repeat)
    completes.  Typical wall-clock time: 1-3 minutes depending on model
    speed and the number of revision loops.
    """
    # Build the task string that the agent expects.
    # Include genre / audience / tone context if provided so the LLM
    # has richer input, but keep it as a single "task" string.
    task_parts: list[str] = [request.story_idea]
    if request.genre:
        task_parts.append(f"Genre: {request.genre}")
    if request.target_audience:
        task_parts.append(f"Target audience: {request.target_audience}")
    if request.tone:
        task_parts.append(f"Tone: {request.tone}")
    if request.episode_count_preference:
        task_parts.append(
            f"Preferred episode count: {request.episode_count_preference}"
        )
    task = "\n".join(task_parts)

    initial_state = {
        "task": task,
        "episode_plan": None,
        "emotional_arc": None,
        "retention_analysis": None,
        "cliffhanger_analysis": None,
        "optimization_report": None,
        "revision_number": 1,
        "max_revisions": request.max_revisions,
    }

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    logger.info(
        "Starting analysis for story=%r  max_revisions=%d  thread=%s",
        request.story_idea[:80],
        request.max_revisions,
        thread_id,
    )

    try:
        final_state = _graph.invoke(initial_state, config)
    except Exception:
        logger.exception("LangGraph pipeline failed")
        raise HTTPException(
            status_code=502,
            detail="The AI analysis pipeline encountered an error. Please try again.",
        )

    # Extract structured results from the final state.
    episode_plan = final_state.get("episode_plan")
    emotional_arc = final_state.get("emotional_arc")
    retention_analysis = final_state.get("retention_analysis")
    cliffhanger_analysis = final_state.get("cliffhanger_analysis")
    optimization_report = final_state.get("optimization_report")
    revision_number = final_state.get("revision_number", 1)

    if not all(
        [
            episode_plan,
            emotional_arc,
            retention_analysis,
            cliffhanger_analysis,
            optimization_report,
        ]
    ):
        raise HTTPException(
            status_code=502,
            detail="The analysis pipeline completed but produced incomplete results.",
        )

    run_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    # Build the response payload.
    response = AnalyzeResponse(
        run_id=run_id,
        story_idea=request.story_idea,
        revisions_completed=revision_number - 1,
        episode_plan=episode_plan,
        emotional_arc=emotional_arc,
        retention_analysis=retention_analysis,
        cliffhanger_analysis=cliffhanger_analysis,
        optimization_report=optimization_report,
        created_at=now,
    )

    # Persist to database.
    response_dict = response.model_dump(mode="json")

    run = AnalysisRun(
        id=run_id,
        story_idea=request.story_idea,
        request_payload=request.model_dump(mode="json"),
        response_payload=response_dict,
        created_at=now,
    )

    try:
        db.add(run)
        db.commit()
        logger.info("Persisted analysis run %s", run_id)
    except Exception:
        db.rollback()
        logger.exception("Failed to persist analysis run %s", run_id)
        # Still return the response even if DB write fails — the analysis
        # is the valuable part; persistence is secondary.

    return response
