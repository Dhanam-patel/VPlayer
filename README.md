# StoryFlow

AI-powered Episodic Intelligence Engine that takes a raw story idea and decomposes it into optimized multi-episode arcs for 90-second vertical video (TikTok/Reels/Shorts). Analyzes emotional progression, retention risk, cliffhanger strength, and generates structured optimization suggestions.

## Architecture

```
frontend/app.py  (Streamlit UI)
       |
       | POST /episodic-intelligence/analyze/stream  (SSE)
       v
backend/main.py  (FastAPI)
       |
       v
engine/graph.py  (LangGraph pipeline — 10 nodes, 2 conditional loops)
       |
       v
PostgreSQL       (analysis run persistence)
```

### LangGraph Pipeline (A0-A8 + Optimizer)

```
START -> A0 (input_classifier)
              |
              v
         A1 (story_expander) <-----------+
              |                           | (fail: score < 8)
              v                           |
         A2 (story_validator) --[should_retry_story]
              | (pass: score >= 8)
              v
    +-> A3 (episode_planner) <---------------------------+
    |         |                                          |
    |         v                                          |
    |    A4 (episode_scripter)                           |
    |         |                                          |
    |         +--> A5 (emotional_arc_scorer) --+          |
    |         +--> A6 (cliffhanger_scorer) ----+          |
    |                                          v          |
    |                          A7 (retention_risk) -------+
    |                                          |          |
    |                                          v          |
    |                          A8 (final_validator) -[should_replan]
    |                                          | (pass)   | (fail)
    |                                          v          |
    |                                    optimizer -> END |
    |                                                     |
    +-----------------------------------------------------+
```

- **A5 and A6** run in parallel (fan-out from A4, fan-in to A7).
- **A1 <-> A2 loop**: retries story expansion up to `max_revisions` times.
- **A3 -> A8 loop**: retries the full script pipeline up to `max_revisions` times.
- **Optimizer** is advisory-only (no feedback loop), runs after A8 passes.
- All scripts use **third-person narrative voiceover style** (no direct dialogue).

All LLM calls use `langchain-google-genai` (`ChatGoogleGenerativeAI`) with `.with_structured_output()` to produce strict Pydantic models.

## Prerequisites

- Python >= 3.13
- [uv](https://docs.astral.sh/uv/) package manager
- Docker (for PostgreSQL)
- Google Cloud credentials (ADC) with access to Gemini models

## Setup

### 1. Start PostgreSQL

```bash
cd backend
docker compose up -d
```

This starts a `pgvector/pgvector:pg17` container on port 5432 with database `vplayer`.

### 2. Configure environment

Copy the sample and fill in your values:

```bash
cp backend/.env.sample backend/.env
```

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vplayer
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_GENERATION_MODEL=gemini-2.5-flash
GOOGLE_GENAI_USE_VERTEXAI=true
```

### 3. Authenticate with Google Cloud

```bash
gcloud auth application-default login
```

### 4. Install dependencies

```bash
cd backend
uv sync
```

### 5. Run database migration

```bash
cd backend
uv run alembic upgrade head
```

### 6. Start the API

```bash
cd backend
uv run fastapi dev main.py
```

The API starts at `http://localhost:8000` with auto-reload enabled. For production, use `uv run fastapi run main.py --host 0.0.0.0 --port 8000`.

### 7. Start the frontend

```bash
cd frontend
pip install -r requirements.txt
streamlit run app.py
```

The Streamlit UI connects to `http://localhost:8000` by default (configurable in the sidebar).

## API

### `GET /health`

Liveness probe. Returns `{"status": "ok"}`.

### `POST /episodic-intelligence/analyze`

Runs the full LangGraph pipeline synchronously and returns structured results. This endpoint blocks until completion (1-3 minutes typical).

**Request:**

```json
{
  "story_idea": "A broke food-delivery rider discovers that one customer is leaving clues to a missing sister case.",
  "genre": "thriller",
  "target_audience": "18-30 mobile-first viewers",
  "tone": "tense",
  "episode_count_preference": 6,
  "max_revisions": 2
}
```

| Field                      | Type   | Default                     | Description                                  |
|----------------------------|--------|-----------------------------|----------------------------------------------|
| `story_idea`               | string | (required)                  | The raw story idea to analyze                |
| `genre`                    | string | `""`                        | Genre hint (e.g. thriller)                   |
| `target_audience`          | string | `"18-30 mobile-first viewers"` | Target audience description               |
| `tone`                     | string | `""`                        | Desired tone (e.g. tense)                    |
| `episode_count_preference` | int    | `6`                         | Number of episodes (5-8)                     |
| `max_revisions`            | int    | `2`                         | Max revision loops for both story and pipeline (1-5) |

**Response:**

Returns a JSON object with:

- `run_id` — UUID for this analysis run
- `story_idea` — echoed back
- `revisions_completed` — number of pipeline revision passes completed
- `episode_planner` — structured episode plan (episodes with outlines, emotional arc notes, cliffhanger ideas, retention hooks)
- `episode_scripts` — full narrative voiceover scripts per episode with scene directions and continuity notes
- `emotional_arc` — per-episode emotion beats, coherence score, tension curve
- `retention_analysis` — per-episode retention scores, risk zones, suggested fixes
- `cliffhanger_analysis` — per-episode cliffhanger scores with curiosity/stakes/emotional breakdown
- `optimization_report` — quality scores, top priorities, per-episode suggestions
- `created_at` — timestamp

Each analysis run is persisted to the `analysis_runs` table in PostgreSQL.

### `POST /episodic-intelligence/analyze/stream`

Streaming variant that emits [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) (SSE) as each LangGraph node starts and completes. Same request body as `/analyze`. The Streamlit frontend uses this endpoint by default.

**SSE event types:**

| Event       | When                             | Payload                                              |
|-------------|----------------------------------|------------------------------------------------------|
| `progress`  | A graph node starts or ends      | `{"node": "<name>", "status": "started\|completed"}` |
| `thinking`  | LLM emits a reasoning/thinking chunk | `{"node": "<name>", "text": "<thinking content>"}` |
| `complete`  | Pipeline finished                | Full `AnalyzeResponse` JSON                          |
| `error`     | Pipeline failed                  | `{"detail": "<error message>"}`                      |

**Example SSE stream:**

```
event: progress
data: {"node": "input_classifier", "status": "started"}

event: progress
data: {"node": "input_classifier", "status": "completed"}

event: progress
data: {"node": "story_expander", "status": "started"}

event: progress
data: {"node": "story_expander", "status": "completed"}

event: progress
data: {"node": "story_validator", "status": "started"}

event: progress
data: {"node": "story_validator", "status": "completed"}

event: progress
data: {"node": "episode_planner", "status": "started"}

...

event: progress
data: {"node": "emotional_arc_scorer", "status": "started"}

event: progress
data: {"node": "cliffhanger_strength_scorer", "status": "started"}

...

event: complete
data: {"run_id": "...", "episode_planner": {...}, "episode_scripts": {...}, ...}
```

### Interactive docs

OpenAPI docs are available at `http://localhost:8000/docs` when the server is running.

## Project Structure

```
backend/
  main.py                       # FastAPI entry point
  app/
    config.py                   # Pydantic BaseSettings
    db.py                       # SQLAlchemy engine, session, Base
    models.py                   # AnalysisRun ORM model
    schemas.py                  # Request/Response Pydantic models
    routes/
      analyze.py                # POST /episodic-intelligence/analyze{/stream}
  engine/
    graph.py                    # LangGraph graph builder (10 nodes, 2 loops)
    llm.py                      # LLM factory (ChatGoogleGenerativeAI)
    prompts.py                  # Prompt templates for all nodes
    state.py                    # EpisodeEngineState + Pydantic output models
    nodes/
      input_classifier.py       # A0: Classifies input + A2: Story validator
      story_expander.py         # A1: Expands idea into detailed story
      episode_planner.py        # A3: Plans episode structure
      episode_scripter.py       # A4: Writes narrative voiceover scripts
      emotional_arc_scorer.py   # A5: Scores emotional progression
      cliffhanger_strength_scorer.py  # A6: Scores cliffhanger quality
      retention_risk_analyzer.py      # A7: Predicts retention risk
      final_validator.py        # A8: Quality gate (pass/replan)
      optimizer.py              # Advisory optimization suggestions
  alembic/
    versions/                   # Database migrations
  docker-compose.yml            # PostgreSQL (pgvector)
  .env                          # Environment variables (git-ignored)
  .env.sample                   # Template for .env

frontend/
  app.py                        # Streamlit UI
  requirements.txt
```
