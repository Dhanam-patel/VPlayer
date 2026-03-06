# StoryFlow

AI-powered episodic intelligence engine that decomposes story ideas into optimized multi-episode arcs for 90-second vertical video. Analyzes emotional progression, retention risk, cliffhanger strength, and generates structured optimization suggestions.

## Architecture

```
frontend/app.py  (Streamlit UI)
       |
       | POST /episodic-intelligence/analyze
       v
backend/main.py  (FastAPI)
       |
       v
engine/graph.py  (LangGraph pipeline)
       |
       v
PostgreSQL       (analysis run persistence)
```

### LangGraph Pipeline

```
                        ┌─> emotional_arc ──────┐
START -> story_decomposer ──┼─> retention_risk ──────┼──> optimizer ──> [should_continue]
                        └─> cliffhanger_scorer ─┘           |
                                                  +---------+---------+
                                                  |                   |
                                           story_decomposer         END
                                           (re-optimize)           (done)
```

The three analysis nodes run in parallel within a single LangGraph superstep. With `max_revisions=2` (default), the agent completes 2 full decompose-analyze-optimize cycles. Typical wall-clock time: 1-3 minutes.

All LLM calls use `langchain-google-genai` (`ChatGoogleGenerativeAI`) with `.with_structured_output()` to produce strict Pydantic models — no tools/function calling.

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
uv run python main.py
```

The API starts at `http://localhost:8000` with auto-reload enabled.

### 7. Start the frontend (optional)

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

| Field                      | Type   | Default                     | Description                     |
|----------------------------|--------|-----------------------------|---------------------------------|
| `story_idea`               | string | (required)                  | The raw story idea to analyze   |
| `genre`                    | string | `""`                        | Genre hint (e.g. thriller)      |
| `target_audience`          | string | `"18-30 mobile-first viewers"` | Target audience description  |
| `tone`                     | string | `""`                        | Desired tone (e.g. tense)       |
| `episode_count_preference` | int    | `6`                         | Number of episodes (5-8)        |
| `max_revisions`            | int    | `2`                         | Optimization loops (1-5)        |

**Response:**

Returns a JSON object with:

- `run_id` — UUID for this analysis run
- `story_idea` — echoed back
- `revisions_completed` — number of optimization passes completed
- `episode_plan` — full episode arc decomposition (episodes with hooks, beats, cliffhangers)
- `emotional_arc` — per-episode emotion beats, coherence score, tension curve
- `retention_analysis` — per-episode retention scores, risk zones, suggested fixes
- `cliffhanger_analysis` — per-episode cliffhanger scores with curiosity/stakes/emotional breakdown
- `optimization_report` — quality scores, top priorities, per-episode suggestions
- `created_at` — timestamp

Each analysis run is persisted to the `analysis_runs` table in PostgreSQL.

### Interactive docs

OpenAPI docs are available at `http://localhost:8000/docs` when the server is running.

## Project Structure

```
backend/
  main.py                   # FastAPI entry point
  app/
    config.py               # Pydantic BaseSettings
    db.py                   # SQLAlchemy engine, session, Base
    models.py               # AnalysisRun ORM model
    schemas.py              # Request/Response Pydantic models
    routes/
      analyze.py            # POST /episodic-intelligence/analyze
  engine/
    graph.py                # LangGraph graph builder
    llm.py                  # LLM factory (ChatGoogleGenerativeAI)
    prompts.py              # Prompt templates
    state.py                # EpisodeEngineState + Pydantic output models
    nodes/
      story_decomposer.py   # Decomposes story into episode arc
      emotional_arc.py      # Analyzes emotional progression
      retention_risk.py     # Predicts retention risk per episode
      cliffhanger_scorer.py # Scores cliffhanger strength
      optimizer.py          # Generates optimization suggestions
  alembic/
    versions/               # Database migrations
  docker-compose.yml        # PostgreSQL (pgvector)
  .env                      # Environment variables (git-ignored)
  .env.sample               # Template for .env

frontend/
  app.py                    # Streamlit UI
  requirements.txt
```
