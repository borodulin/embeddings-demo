.PHONY: help up down restart logs ps migrate import import-limit index-vectors index-vectors-limit dev build lint

help:
	@echo "Available targets:"
	@echo "  make up            - Start all services (postgres, embeddings, frontend)"
	@echo "  make down          - Stop all services"
	@echo "  make restart       - Restart all services"
	@echo "  make logs          - Follow docker compose logs"
	@echo "  make ps            - Show services status"
	@echo "  make migrate       - Run DB migrations in frontend container"
	@echo "  make import        - Import all data from import folder"
	@echo "  make import-limit N=100 - Import only N records (smoke test)"
	@echo "  make index-vectors - Build vectors for pending/error records"
	@echo "  make index-vectors-limit N=100 - Index only N records (smoke test)"
	@echo "  make dev           - Run frontend dev server locally"
	@echo "  make build         - Build frontend locally"
	@echo "  make lint          - Lint frontend locally"

up:
	docker compose up -d

down:
	docker compose down

down-clear:
	docker compose down --volumes

restart: down up

logs:
	docker compose logs -f

ps:
	docker compose ps

migrate:
	docker compose exec frontend sh -lc "npm run db:migrate"

import:
	docker compose exec frontend sh -lc "npm run import:data"

import-limit:
	docker compose exec frontend sh -lc "npm run import:data -- --limit $${N:-100}"

index-vectors:
	docker compose exec frontend sh -lc "npm run index:vectors"

index-vectors-limit:
	docker compose exec frontend sh -lc "npm run index:vectors -- --limit $${N:-100}"

dev:
	cd frontend && npm run dev

build:
	cd frontend && npm run build

lint:
	cd frontend && npm run lint

llm-embeddings:
	docker run --gpus all -p 8080:80 -v $(pwd)/data:/data \
 		ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 \
		--model-id Qwen/Qwen3-Embedding-0.6B
embeddings-test:
	curl 127.0.0.1:8080/embed -X POST \
    	-d '{"inputs":"What is Deep Learning?"}' \
    	-H 'Content-Type: application/json'