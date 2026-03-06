.PHONY: help backend-install backend-run backend-dev backend-migrate backend-migration backend-db frontend-install frontend-run docker-up docker-down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Backend ──────────────────────────────────────────────────

backend-install: ## Install backend dependencies
	cd backend && uv sync

backend-run: ## Run backend server
	cd backend && uv run python main.py

backend-dev: ## Run backend server with reload
	cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

backend-migrate: ## Run alembic migrations
	cd backend && uv run alembic upgrade head

backend-migration: ## Create a new alembic migration (usage: make backend-migration msg="add users table")
	cd backend && uv run alembic revision --autogenerate -m "$(msg)"

backend-db: ## Start postgres via docker-compose
	cd backend && docker compose up -d

# ── Frontend ─────────────────────────────────────────────────

frontend-install: ## Install frontend dependencies
	cd frontend && pip install -r requirements.txt

frontend-run: ## Run Streamlit frontend
	cd frontend && streamlit run app.py

# ── Docker ───────────────────────────────────────────────────

docker-up: ## Start all docker services
	cd backend && docker compose up -d

docker-down: ## Stop all docker services
	cd backend && docker compose down
