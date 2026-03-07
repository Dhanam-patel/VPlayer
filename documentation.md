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
- [Deployment](#deployment)
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
│   React Frontend        │   frontend/src/ (Vite + Tailwind)
│   (SPA with SSE)        │
│                         │
│   Streamlit Frontend    │   frontend/app.py (legacy/prototyping)
│   (Web UI with SSE)     │
└───────────┬─────────────┘
            │ POST /episodic-intelligence/analyze/stream (SSE)
            ▼
┌─────────────────────────┐
│   FastAPI Backend       │   backend/main.py
│   (REST API + SSE +     │
│    CORS + SPA serving)  │
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
- **SSE streaming with thinking transparency**: The streaming endpoint can forward LLM chain-of-thought reasoning to the frontend in real-time (requires `include_thoughts=True` in LLM config; currently disabled by default).
- **Best-effort persistence**: Results are streamed to the client first; database writes happen afterward.
- **Production SPA serving**: In production, the backend serves the built React frontend as a static SPA via the `STATIC_DIR` env var, eliminating the need for a separate frontend server.
- **CORS enabled**: Wide-open CORS (`allow_origins=["*"]`) is configured for development flexibility.

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

### React Frontend

| Library                       | Purpose                          |
| ----------------------------- | -------------------------------- |
| `react` / `react-dom`        | UI framework                     |
| `vite`                        | Build tool & dev server          |
| `tailwindcss`                 | Utility-first CSS                |
| `framer-motion`               | Animations                       |
| `lucide-react`                | Icons                            |
| `jspdf`                       | PDF export                       |
| `@fontsource-variable/inter`  | Inter font                       |

### Streamlit Frontend (Legacy)

| Library      | Purpose                    |
| ------------ | -------------------------- |
| `streamlit`  | Web UI framework           |
| `requests`   | HTTP client for API calls  |

### Infrastructure

| Component      | Details                          |
| -------------- | -------------------------------- |
| Python         | 3.13                             |
| Node.js        | 20 (for React frontend)         |
| Database       | PostgreSQL 17 (pgvector)         |
| LLM            | Google Gemini 2.5 Flash          |
| Package Mgr    | `uv` (backend), `npm` (React frontend), `pip` (Streamlit) |
| Containers     | Docker Compose (database), Dockerfile (full-stack) |
| Deployment     | Fly.io with GitHub Actions CI/CD |

---

## Project Structure

```md
Story-Flow/
├── Makefile                          # Build and run targets
├── Dockerfile                        # Multi-stage build (React + Python)
├── fly.toml                          # Fly.io deployment config
├── LICENSE
├── README.md
├── documentation.md
│
├── .github/
│   └── workflows/
│       └── fly-deploy.yml            # CI/CD: auto-deploy to Fly.io on push to main
│
├── backend/
│   ├── main.py                       # FastAPI application entry point (+ SPA serving)
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
│   │   ├── prompts.py                # All prompt templates (726 lines)
│   │   ├── state.py                  # Pipeline state & Pydantic models
│   │   ├── context/                  # Literary reference texts for story expansion
│   │   │   ├── The_Yellow_Wallpaper.txt
│   │   │   └── A_Scandal_in_Bohemia.txt
│   │   └── nodes/                    # Individual pipeline nodes
│   │       ├── input_classifier.py   # A0: Input classification + A2: Story validator
│   │       ├── story_expander.py     # A1: Idea to narrative expansion
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
    ├── index.html                    # React SPA entry point
    ├── package.json                  # React app dependencies
    ├── vite.config.js                # Vite config (API proxy to backend)
    ├── tailwind.config.js            # Tailwind CSS config
    ├── postcss.config.js             # PostCSS config
    ├── src/                          # React source code
    │   ├── App.jsx                   # Root React component
    │   ├── main.jsx                  # React entry point
    │   ├── index.css                 # Global styles (Tailwind)
    │   ├── mockData.js               # Mock data for development
    │   ├── components/               # Reusable UI components
    │   ├── hooks/                    # Custom React hooks
    │   ├── pages/                    # Page-level components
    │   └── utils/                    # Utility functions
    ├── app.py                        # Streamlit UI (legacy/prototyping, SSE streaming)
    └── requirements.txt              # Streamlit dependencies
```

---

## Getting Started

### Prerequisites

- Python 3.13
- Node.js 20+ (for React frontend)
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
```

For the React frontend:

```bash
cd frontend && npm install
```

### 4. Run Database Migrations

```bash
make backend-migrate
```

### 5. Start the Backend

**Development (auto-reload):**

```bash
make backend-dev
```

**Production:**

```bash
make backend-run
```

The API will be available at `http://localhost:8000`. Verify with:

```bash
curl http://localhost:8000/health
```

### 6. Start the Frontend

**React (recommended):**

```bash
make frontend-dev
```

The Vite dev server starts with API proxy to `http://localhost:8000`.

**Streamlit (legacy):**

```bash
make frontend-install
make frontend-run
```

The Streamlit UI will open at `http://localhost:8501`.

---

## Configuration

Configuration is managed via environment variables loaded through Pydantic settings.

**Settings class:** `backend/app/config.py`

| Variable                     | Default                                                    | Description                                       |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`               | `postgresql://postgres:postgres@localhost:5432/vplayer`     | PostgreSQL connection string                      |
| `GOOGLE_CLOUD_PROJECT`       | *(required)*                                               | Google Cloud project ID                           |
| `GOOGLE_CLOUD_LOCATION`      | `us-central1`                                              | Google Cloud region                               |
| `VERTEX_GENERATION_MODEL`    | `gemini-2.5-flash`                                         | Gemini model to use                               |
| `GOOGLE_GENAI_USE_VERTEXAI`  | `""`                                                       | Enable Vertex AI backend                          |
| `GCP_SERVICE_ACCOUNT_JSON`   | `""`                                                       | Inline JSON service account credentials (alternative to ADC) |
| `STATIC_DIR`                 | `""`                                                       | Path to built React frontend; enables SPA serving when set |

**Note:** The `sync_database_url` property in `config.py` automatically converts `postgresql://` URLs to `postgresql+psycopg2://` for SQLAlchemy/Alembic compatibility.

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
| `thinking` | `{"node": "<name>", "text": "<thinking content>"}` | LLM chain-of-thought reasoning (requires `include_thoughts=True` in LLM config; currently disabled) |
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
| Story Expander | A1 | `engine/nodes/story_expander.py:24` | Expands a brief idea into a 300-600 word narrative with characters, setting, and plot hooks. Uses literary reference texts from `engine/context/` as inspirational context. |
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
- **Authentication:** Google Cloud Application Default Credentials (ADC) or inline service account JSON via `GCP_SERVICE_ACCOUNT_JSON`
- **Output mode:** All calls use `.with_structured_output(PydanticModel)` for strict schema enforcement
- **Thinking mode:** `include_thoughts` is available but currently commented out / disabled in `llm.py:81`

### Prompts

All prompt templates are centralized in `backend/engine/prompts.py` (726 lines). Each node has a corresponding system prompt and human prompt template. Prompts are completely separated from node logic.

---

## Data Models

All pipeline data models are defined in `backend/engine/state.py`.

### Pipeline State

`EpisodeEngineState` (TypedDict) at `state.py:374` is the central state object passed through all nodes. It contains 16 fields tracking every stage of the pipeline.

### Key Pydantic Models

| Model | Line | Purpose |
| ----- | ---- | ------- |
| `EmotionBeat` | `state.py:18` | Single emotional beat within an episode |
| `EpisodeEmotionProfile` | `state.py:30` | Emotional profile for one episode |
| `EmotionalArc` | `state.py:47` | A5 output: complete emotional arc analysis |
| `RiskZone` | `state.py:67` | Retention risk for a time zone (0-30s, 30-60s, 60-90s) |
| `EpisodeRetentionRisk` | `state.py:82` | Retention risk for one episode |
| `RetentionAnalysis` | `state.py:100` | A7 output: complete retention analysis |
| `CliffhangerScore` | `state.py:120` | Cliffhanger score for one episode |
| `CliffhangerAnalysis` | `state.py:142` | A6 output: complete cliffhanger analysis |
| `InputClassification` | `state.py:163` | A0 output: classification result (one-liner vs story) |
| `StoryValidation` | `state.py:183` | A2 output: score, passed flag, coherence/originality/engagement scores, feedback |
| `FinalValidation` | `state.py:214` | A8 output: pass/fail with feedback for replanning |
| `ExpandedStory` | `state.py:243` | A1 output: title, characters, setting, plot hooks, narrative |
| `PlannedEpisode` | `state.py:264` | Single episode plan with outline, hooks, arc, cliffhanger |
| `EpisodePlanner` | `state.py:285` | A3 output: collection of planned episodes |
| `EpisodeScript` | `state.py:301` | Single episode script with scene directions |
| `EpisodeScripts` | `state.py:318` | A4 output: collection of episode scripts |
| `Suggestion` | `state.py:333` | Single optimization suggestion |
| `OptimizationReport` | `state.py:352` | Optimizer output: prioritized suggestions |

---

## Database

### Engine

- **PostgreSQL 17** with pgvector extension
- **Container image:** `pgvector/pgvector:pg17`
- **Default port:** 5432
- **Default database:** `vplayer`
- **Default credentials:** `postgres:postgres`

### ORM

**SQLAlchemy** with `psycopg2` driver. Session management via `SessionLocal` factory with FastAPI dependency injection. The `sync_database_url` property in `config.py` automatically converts `postgresql://` URLs to `postgresql+psycopg2://` for driver compatibility.

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
make backend-migration msg="description of change"
```

---

## Frontend

StoryFlow has two frontend implementations:

### React Frontend (Primary)

**Directory:** `frontend/src/`

A modern React SPA built with Vite and styled with Tailwind CSS.

**Key technologies:** React 18, Vite 6, Tailwind CSS 3, Framer Motion, Lucide React icons, jsPDF for PDF export.

**Features:**

- Text input for story ideas with genre, tone, audience, and episode count controls
- Real-time SSE streaming with progress indicators for each pipeline node
- Structured display of results: episode plans, scripts, emotional arcs, retention risks, cliffhanger scores, and optimization suggestions
- PDF export of analysis results
- Animated transitions via Framer Motion

**Development:**

```bash
make frontend-dev
```

The Vite dev server starts at `http://localhost:5173` (default) and proxies API requests (`/episodic-intelligence` and `/health`) to `http://localhost:8000`.

**Production build:**

```bash
make frontend-build
```

Outputs to `frontend/dist/`. In production deployment, this directory is served by the FastAPI backend via the `STATIC_DIR` env var.

### Streamlit Frontend (Legacy/Prototyping)

**File:** `frontend/app.py`

The original Streamlit-based frontend, still available for prototyping and quick testing.

**Features:**

- Text input for story ideas with genre, tone, audience, and episode count controls
- Real-time SSE streaming with progress indicators for each pipeline node
- Display of LLM thinking/reasoning in real-time
- Structured display of results: episode plans, scripts, emotional arcs, retention risks, cliffhanger scores, and optimization suggestions
- Configurable backend URL (sidebar)

**Running:**

```bash
make frontend-install
make frontend-run
```

Opens at `http://localhost:8501` by default. Connects to the backend at `http://localhost:8000`.

---

## Deployment

### Docker

A multi-stage `Dockerfile` builds both the React frontend and Python backend into a single image:

**Stage 1 (Node 20):** Installs npm dependencies, builds the React frontend with `vite build`.

**Stage 2 (Python 3.13):** Installs `uv`, compiles and installs Python dependencies, copies backend source and the built frontend into `/code/static`.

```bash
# Build the image
make docker-build

# Run locally
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql://... \
  -e GOOGLE_CLOUD_PROJECT=your-project \
  -e GOOGLE_CLOUD_LOCATION=us-central1 \
  -e VERTEX_GENERATION_MODEL=gemini-2.5-flash \
  -e GOOGLE_GENAI_USE_VERTEXAI=true \
  story-flow
```

The `STATIC_DIR=/code/static` env var is set automatically in the Dockerfile, enabling the backend to serve the React SPA. The `/assets` path serves hashed JS/CSS bundles, and all other non-API paths fall back to `index.html` for client-side routing.

### Fly.io

The project includes Fly.io deployment configuration for production hosting:

- **`fly.toml`** — App configuration (region: `bom`, 1 shared CPU, 1 GB RAM, auto-stop/auto-start, HTTPS enforced)
- **`.github/workflows/fly-deploy.yml`** — GitHub Actions workflow that auto-deploys on push to `main`

**Setup:**

1. Create a Fly.io app: `flyctl launch`
2. Set secrets: `flyctl secrets set DATABASE_URL=... GOOGLE_CLOUD_PROJECT=... GCP_SERVICE_ACCOUNT_JSON='...'`
3. Add `FLY_API_TOKEN` to GitHub repository secrets
4. Push to `main` to trigger deployment

---

## Makefile Targets

| Target              | Command                                                        | Description                              |
| ------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| `help`              | `grep ... Makefile`                                            | Show available targets with descriptions |
| `backend-install`   | `cd backend && uv sync`                                        | Install backend dependencies             |
| `backend-run`       | `cd backend && uv run fastapi run main.py --host 0.0.0.0 --port 8000` | Run the backend server (production)      |
| `backend-dev`       | `cd backend && uv run fastapi dev main.py --host 0.0.0.0 --port 8000` | Run backend with auto-reload (development) |
| `backend-migrate`   | `cd backend && uv run alembic upgrade head`                    | Run database migrations                  |
| `backend-migration` | `cd backend && uv run alembic revision --autogenerate -m "$(msg)"` | Create a new migration (usage: `make backend-migration msg="..."`) |
| `backend-db`        | `cd backend && docker compose up -d`                           | Start PostgreSQL container               |
| `frontend-install`  | `cd frontend && pip install -r requirements.txt`               | Install Streamlit frontend dependencies  |
| `frontend-run`      | `cd frontend && streamlit run app.py`                          | Run Streamlit UI                         |
| `frontend-dev`      | `cd frontend && npm run dev`                                   | Run React dev server (Vite, proxies API to backend) |
| `frontend-build`    | `cd frontend && npm run build`                                 | Build React frontend for production      |
| `docker-up`         | `cd backend && docker compose up -d`                           | Start Docker services                    |
| `docker-down`       | `cd backend && docker compose down`                            | Stop Docker services                     |
| `docker-build`      | `docker build -t story-flow .`                                 | Build the full-stack Docker image        |
