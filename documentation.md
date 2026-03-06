# StoryFlow Documentation

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [AI Pipeline](#ai-pipeline)
- [Data Models](#data-models)
- [Database](#database)
- [Frontend](#frontend)
- [Makefile Targets](#makefile-targets)

---

## Overview

StoryFlow is an AI-powered episodic intelligence engine that transforms story ideas into optimized multi-episode arcs for **90-second vertical video** (TikTok, Instagram Reels, YouTube Shorts).

Given a raw story idea, StoryFlow:

1. Classifies the input type (one-liner vs full story)
2. Expands brief ideas into full narratives
3. Plans and scripts 5-8 episodes
4. Analyzes emotional progression, retention risk, and cliffhanger strength
5. Validates quality with automated feedback loops
6. Produces structured optimization suggestions

---

## Architecture

```md
┌─────────────────────────┐
│   Streamlit Frontend    │   frontend/app.py
│   (Web UI with SSE)     │
└───────────┬─────────────┘
            │ POST /episodic-intelligence/analyze/stream (SSE)
            ▼
┌─────────────────────────┐
│   FastAPI Backend       │   backend/main.py
│   (REST API + SSE)      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   LangGraph Engine      │   backend/engine/graph.py
│   (10 nodes, 2 loops)   │
│                         │
│   Google Gemini 2.5     │
│   (Structured Output)   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   PostgreSQL 17         │   docker-compose.yml
│   (pgvector, JSONB)     │
└─────────────────────────┘
```

### Key Design Principles

- **Graph-as-code pipeline**: The AI pipeline is defined declaratively using LangGraph's `StateGraph`, with nodes as pure functions and conditional edges for loop control.
- **Structured LLM output**: Every LLM call uses `.with_structured_output(PydanticModel)`. No raw text parsing.
- **Prompt/logic separation**: All prompts are centralized in `engine/prompts.py`, separate from node logic.
- **SSE streaming with thinking transparency**: The streaming endpoint forwards LLM chain-of-thought reasoning to the frontend in real-time.
- **Best-effort persistence**: Results are streamed to the client first; database writes happen afterward.

---

## Tech Stack

### Backend

| Library                  | Purpose                                |
| ------------------------ | -------------------------------------- |
| `fastapi[standard]`     | REST API framework (includes uvicorn)  |
| `langgraph`             | AI pipeline orchestration (graph-based)|
| `langchain-google-genai`| Google Gemini LLM integration          |
| `google-genai`          | Google GenAI SDK                       |
| `pydantic` / `pydantic-settings` | Data validation & config      |
| `sqlalchemy`            | ORM / database access                  |
| `alembic`               | Database schema migrations             |
| `psycopg2-binary`       | PostgreSQL driver                      |
| `python-dotenv`         | Environment variable loading           |

### Frontend

| Library      | Purpose                    |
| ------------ | -------------------------- |
| `streamlit`  | Web UI framework           |
| `requests`   | HTTP client for API calls  |

### Infrastructure

| Component      | Details                          |
| -------------- | -------------------------------- |
| Python         | 3.13                             |
| Database       | PostgreSQL 17 (pgvector)         |
| LLM            | Google Gemini 2.5 Flash          |
| Package Mgr    | `uv` (backend), `pip` (frontend)|
| Containers     | Docker Compose (database only)   |

---

## Project Structure

```md
Story-Flow/
├── Makefile                          # Build and run targets
├── README.md                         # Project overview
│
├── backend/
│   ├── main.py                       # FastAPI application entry point
│   ├── pyproject.toml                # Python dependencies (uv)
│   ├── uv.lock                       # Dependency lockfile
│   ├── docker-compose.yml            # PostgreSQL container config
│   ├── alembic.ini                   # Alembic migration config
│   ├── .env.sample                   # Environment variable template
│   ├── .python-version               # Python 3.13
│   ├── graph.png                     # Visual diagram of the pipeline
│   │
│   ├── app/                          # Application layer
│   │   ├── config.py                 # Pydantic settings (env vars)
│   │   ├── db.py                     # SQLAlchemy engine & sessions
│   │   ├── models.py                 # ORM models (AnalysisRun)
│   │   ├── schemas.py                # API request/response schemas
│   │   └── routes/
│   │       └── analyze.py            # /episodic-intelligence/* endpoints
│   │
│   ├── engine/                       # AI pipeline layer
│   │   ├── graph.py                  # LangGraph graph builder
│   │   ├── llm.py                    # LLM factory (Gemini via Vertex AI)
│   │   ├── prompts.py                # All prompt templates (619 lines)
│   │   ├── state.py                  # Pipeline state & Pydantic models
│   │   └── nodes/                    # Individual pipeline nodes
│   │       ├── input_classifier.py   # A0: Input classification
│   │       ├── story_expander.py     # A1: Idea to narrative expansion
│   │       ├── story_decomposer.py   # Legacy (unused)
│   │       ├── episode_planner.py    # A3: Episode outline planning
│   │       ├── episode_scripter.py   # A4: Script generation
│   │       ├── emotional_arc_scorer.py       # A5: Emotional arc analysis
│   │       ├── cliffhanger_strength_scorer.py # A6: Cliffhanger scoring
│   │       ├── retention_risk_analyzer.py    # A7: Retention risk prediction
│   │       ├── final_validator.py    # A8: Quality gate
│   │       └── optimizer.py          # Advisory optimization suggestions
│   │
│   └── alembic/                      # Database migrations
│       ├── env.py
│       ├── script.py.mako
│       └── versions/
│           ├── 0001_create_analysis_runs.py
│           └── 0002_rebuild_analysis_runs.py
│
└── frontend/
    ├── app.py                        # Streamlit UI (SSE streaming)
    └── requirements.txt              # Frontend dependencies
```

---

## Getting Started

### Prerequisites

- Python 3.13
- Docker (for PostgreSQL)
- Google Cloud credentials (ADC or service account) with Vertex AI access
- `uv` package manager ([install](https://docs.astral.sh/uv/))

### 1. Start the Database

```bash
make docker-up
```

This starts a PostgreSQL 17 container with pgvector on port 5432.

### 2. Configure Environment Variables

```bash
cp backend/.env.sample backend/.env
```

Edit `backend/.env` with your values:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vplayer
GOOGLE_CLOUD_PROJECT=<your-gcp-project-id>
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_GENERATION_MODEL=gemini-2.5-flash
GOOGLE_GENAI_USE_VERTEXAI=true
```

### 3. Install Dependencies

```bash
make backend-install
make frontend-install
```

### 4. Run Database Migrations

```bash
make backend-migrate
```

### 5. Start the Backend

```bash
make backend-run
```

The API will be available at `http://localhost:8000`. Verify with:

```bash
curl http://localhost:8000/health
```

### 6. Start the Frontend

```bash
make frontend-run
```

The Streamlit UI will open at `http://localhost:8501`.

---

## Configuration

Configuration is managed via environment variables loaded through Pydantic settings.

**Settings class:** `backend/app/config.py`

| Variable                   | Default                                                    | Description                    |
| -------------------------- | ---------------------------------------------------------- | ------------------------------ |
| `DATABASE_URL`             | `postgresql://postgres:postgres@localhost:5432/vplayer`     | PostgreSQL connection string   |
| `GOOGLE_CLOUD_PROJECT`     | *(required)*                                               | Google Cloud project ID        |
| `GOOGLE_CLOUD_LOCATION`    | `us-central1`                                              | Google Cloud region            |
| `VERTEX_GENERATION_MODEL`  | `gemini-2.5-flash`                                         | Gemini model to use            |
| `GOOGLE_GENAI_USE_VERTEXAI`| `true`                                                     | Enable Vertex AI backend       |

---

## API Reference

**Base URL:** `http://localhost:8000`

### Health Check

```
GET /health
```

**Response:**

```json
{ "status": "ok" }
```

### Analyze (Synchronous)

```bash
POST /episodic-intelligence/analyze
```

Runs the full pipeline and returns the result when complete. Blocks for 1-3 minutes depending on story complexity.

**Request body:**

```json
{
  "story_idea": "A lonely astronaut discovers alien music on Mars",
  "genre": "sci-fi",
  "target_audience": "18-30 mobile-first viewers",
  "tone": "mysterious",
  "episode_count_preference": 6,
  "max_revisions": 2
}
```

| Field                      | Type   | Required | Default                        |
| -------------------------- | ------ | -------- | ------------------------------ |
| `story_idea`               | string | Yes      | -                              |
| `genre`                    | string | No       | `""`                           |
| `target_audience`          | string | No       | `"18-30 mobile-first viewers"` |
| `tone`                     | string | No       | `""`                           |
| `episode_count_preference` | int    | No       | `6` (range: 5-8)              |
| `max_revisions`            | int    | No       | `2` (range: 1-5)              |

**Response body:** See [AnalyzeResponse](#analyzeresponse) schema.

### Analyze (Streaming)

```bash
POST /episodic-intelligence/analyze/stream
```

Real-time SSE streaming endpoint. Same request body as the synchronous endpoint.

**SSE event types:**

| Event      | Payload                                            | Description                         |
| ---------- | -------------------------------------------------- | ----------------------------------- |
| `progress` | `{"node": "<name>", "status": "started\|completed"}` | Node execution lifecycle         |
| `thinking` | `{"node": "<name>", "text": "<thinking content>"}` | LLM chain-of-thought reasoning     |
| `complete` | Full `AnalyzeResponse` JSON                        | Pipeline finished successfully      |
| `error`    | `{"detail": "<error message>"}`                    | Pipeline failed                     |

### AnalyzeResponse

```json
{
  "run_id": "uuid",
  "story_idea": "string",
  "revisions_completed": 0,
  "episode_planner": { ... },
  "episode_scripts": { ... },
  "emotional_arc": { ... },
  "retention_analysis": { ... },
  "cliffhanger_analysis": { ... },
  "optimization_report": { ... },
  "created_at": "ISO 8601 timestamp"
}
```

Defined in `backend/app/schemas.py:56-70`.

---

## AI Pipeline

The core of StoryFlow is a LangGraph state machine with 10 nodes and 2 feedback loops.

**Graph definition:** `backend/engine/graph.py`

### Pipeline Flow

```
START
  │
  ▼
[A0] Input Classifier ──── Classifies input as "one-liner" or "story"
  │
  ├─── (one-liner) ──►  [A1] Story Expander ──► [A2] Story Validator
  │                            ▲                        │
  │                            │   (score < 8, ≤3x)     │
  │                            └────────────────────────┘
  │                                     │ (passed)
  ├─── (story) ─────────────────────────┤
  │                                     │
  ▼                                     ▼
[A3] Episode Planner ◄─────────────────────
  │
  ▼
[A4] Episode Scripter
  │
  ▼
┌──────────────────────────┐
│  Parallel Execution      │
│  [A5] Emotional Arc      │
│  [A6] Cliffhanger Score  │
└──────────────────────────┘
  │
  ▼
[A7] Retention Risk Analyzer
  │
  ▼
[A8] Final Validator
  │
  ├─── (avg < 7, revisions left) ──► [A3] Episode Planner (replan)
  │
  ├─── (passed or max revisions) ──►
  ▼
[Optimizer] ──► END
```

### Node Details

| Node | ID | File | Description |
| ---- | -- | ---- | ----------- |
| Input Classifier | A0 | `engine/nodes/input_classifier.py:25` | Classifies input as "one-liner" or "story" |
| Story Expander | A1 | `engine/nodes/story_expander.py:24` | Expands a brief idea into a 300-600 word narrative with characters, setting, and plot hooks |
| Story Validator | A2 | `engine/nodes/input_classifier.py:41` | Validates expanded stories. Score >= 8 passes; otherwise loops back to A1 with feedback (max 3 retries) |
| Episode Planner | A3 | `engine/nodes/episode_planner.py:24` | Plans 5-8 episodes with outlines, hooks, emotional arcs, and cliffhanger ideas |
| Episode Scripter | A4 | `engine/nodes/episode_scripter.py:17` | Generates ~225-word scripts per episode with scene directions and continuity notes |
| Emotional Arc Scorer | A5 | `engine/nodes/emotional_arc_scorer.py:17` | Analyzes per-episode emotional progression with emotion beats and coherence scoring |
| Cliffhanger Scorer | A6 | `engine/nodes/cliffhanger_strength_scorer.py:20` | Scores cliffhanger strength (1-10) with curiosity, stakes, and emotional breakdown |
| Retention Risk Analyzer | A7 | `engine/nodes/retention_risk_analyzer.py:20` | Predicts per-episode retention risk (0-100) with zone-specific drop-off analysis (0-30s, 30-60s, 60-90s) |
| Final Validator | A8 | `engine/nodes/final_validator.py:18` | Quality gate: average score >= 7 passes; otherwise triggers replan from A3 (up to `max_revisions` times) |
| Optimizer | -- | `engine/nodes/optimizer.py:18` | Generates prioritized, actionable optimization suggestions |

### Feedback Loops

1. **Story Validation Loop (A1 <-> A2):** If the expanded story scores below 8, it loops back to the Story Expander with specific feedback. Maximum 3 retries. Controlled by `_should_retry_story()` at `engine/graph.py:63`.

2. **Pipeline Revision Loop (A3 -> A8):** If the Final Validator's average score is below 7, the pipeline replans from Episode Planner. Maximum retries controlled by `max_revisions` (default 2). Controlled by `_should_replan()` at `engine/graph.py:84`.

### Parallelism

Nodes A5 (Emotional Arc Scorer) and A6 (Cliffhanger Scorer) execute in parallel within a single LangGraph superstep. Both must complete before A7 starts. Defined at `engine/graph.py:160-165`.

### LLM Configuration

**Factory:** `backend/engine/llm.py`

- **Model:** Google Gemini 2.5 Flash (configurable via `VERTEX_GENERATION_MODEL`)
- **Provider:** `langchain-google-genai` with `ChatGoogleGenerativeAI`
- **Authentication:** Google Cloud Application Default Credentials (ADC) or service account
- **Output mode:** All calls use `.with_structured_output(PydanticModel)` for strict schema enforcement

### Prompts

All prompt templates are centralized in `backend/engine/prompts.py` (619 lines). Each node has a corresponding system prompt and human prompt template. Prompts are completely separated from node logic.

---

## Data Models

All pipeline data models are defined in `backend/engine/state.py`.

### Pipeline State

`EpisodeEngineState` (TypedDict) at `state.py:413` is the central state object passed through all nodes. It contains 20+ fields tracking every stage of the pipeline.

### Key Pydantic Models

| Model | Line | Purpose |
| ----- | ---- | ------- |
| `InputClassification` | `state.py:200` | A0 output: classification result (one-liner vs story) |
| `ExpandedStory` | `state.py:278` | A1 output: title, characters, setting, plot hooks, narrative |
| `StoryValidation` | `state.py:220` | A2 output: score, passed flag, coherence/originality/engagement scores, feedback |
| `PlannedEpisode` | `state.py:299` | Single episode plan with outline, hooks, arc, cliffhanger |
| `EpisodePlanner` | `state.py:322` | A3 output: collection of planned episodes |
| `EpisodeScript` | `state.py:338` | Single episode script with scene directions |
| `EpisodeScripts` | `state.py:355` | A4 output: collection of episode scripts |
| `EmotionBeat` | `state.py:55` | Single emotional beat within an episode |
| `EpisodeEmotionProfile` | `state.py:67` | Emotional profile for one episode |
| `EmotionalArc` | `state.py:84` | A5 output: complete emotional arc analysis |
| `RiskZone` | `state.py:104` | Retention risk for a time zone (0-30s, 30-60s, 60-90s) |
| `EpisodeRetentionRisk` | `state.py:119` | Retention risk for one episode |
| `RetentionAnalysis` | `state.py:137` | A7 output: complete retention analysis |
| `CliffhangerScore` | `state.py:157` | Cliffhanger score for one episode |
| `CliffhangerAnalysis` | `state.py:179` | A6 output: complete cliffhanger analysis |
| `FinalValidation` | `state.py:249` | A8 output: pass/fail with feedback for replanning |
| `Suggestion` | `state.py:372` | Single optimization suggestion |
| `OptimizationReport` | `state.py:391` | Optimizer output: prioritized suggestions |

---

## Database

### Engine

- **PostgreSQL 17** with pgvector extension
- **Container image:** `pgvector/pgvector:pg17`
- **Default port:** 5432
- **Default database:** `vplayer`
- **Default credentials:** `postgres:postgres`

### ORM

**SQLAlchemy** with `psycopg2` driver. Session management via `SessionLocal` factory with FastAPI dependency injection.

- **Engine/session setup:** `backend/app/db.py`
- **Base class:** `backend/app/db.py`

### Tables

#### `analysis_runs`

Defined in `backend/app/models.py:15-33`.

| Column             | Type          | Notes                    |
| ------------------ | ------------- | ------------------------ |
| `id`               | UUID          | Primary key, auto-generated |
| `story_idea`       | Text          | Not null                 |
| `request_payload`  | JSONB         | Full request body        |
| `response_payload` | JSONB         | Full response body       |
| `created_at`       | DateTime (tz) | UTC timestamp            |

### Migrations

Managed by Alembic. Configuration in `backend/alembic.ini`.

| Revision | File | Description |
| -------- | ---- | ----------- |
| `20260305_0001` | `alembic/versions/0001_create_analysis_runs.py` | Initial table creation |
| `20260306_0002` | `alembic/versions/0002_rebuild_analysis_runs.py` | Schema rebuild to JSONB request/response payloads |

**Run migrations:**

```bash
make backend-migrate
```

**Create a new migration:**

```bash
make backend-migration
```

---

## Frontend Implementation

**File:** `frontend/app.py`

The frontend is a Streamlit application that provides a web UI for interacting with the StoryFlow API.

### Features

- Text input for story ideas with genre, tone, audience, and episode count controls
- Real-time SSE streaming with progress indicators for each pipeline node
- Display of LLM thinking/reasoning in real-time
- Structured display of results: episode plans, scripts, emotional arcs, retention risks, cliffhanger scores, and optimization suggestions
- Configurable backend URL (sidebar)

### Running

```bash
make frontend-run
```

Opens at `http://localhost:8501` by default. Connects to the backend at `http://localhost:8000`.

---

## Makefile Targets

| Target              | Command                                            | Description                    |
| ------------------- | -------------------------------------------------- | ------------------------------ |
| `backend-install`   | `cd backend && uv sync`                            | Install backend dependencies   |
| `backend-run`       | `cd backend && uv run python main.py`              | Run the backend server         |
| `backend-dev`       | `cd backend && uv run fastapi main:app --reload`   | Run backend with auto-reload   |
| `backend-migrate`   | `cd backend && uv run alembic upgrade head`        | Run database migrations        |
| `backend-migration` | `cd backend && uv run alembic revision --autogenerate` | Create a new migration     |
| `backend-db`        | `cd backend && docker compose up -d`               | Start PostgreSQL container     |
| `frontend-install`  | `cd frontend && pip install -r requirements.txt`   | Install frontend dependencies  |
| `frontend-run`      | `cd frontend && streamlit run app.py`              | Run Streamlit UI               |
| `docker-up`         | `cd backend && docker compose up -d`               | Start Docker services          |
| `docker-down`       | `cd backend && docker compose down`                | Stop Docker services           |
