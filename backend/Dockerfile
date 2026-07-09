# syntax=docker/dockerfile:1
# Multi-stage-ish single image kept simple for the dev skeleton.
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps: build tools for psycopg2/bcrypt at install time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first for better layer caching.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e ".[dev]"

# Presidio's NER backend needs a spaCy model. Cached in its own layer.
RUN python -m spacy download en_core_web_lg

# App source (bind-mounted over this in dev compose for hot reload).
COPY . .

EXPOSE 8000

# Default command; compose overrides to run migrations first.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
