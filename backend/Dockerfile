# FastAPI pipeline only — avoids Railpack failing on Node+Python in the same folder.
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY config ./config
COPY src ./src

WORKDIR /app/src

EXPOSE 8001

# Railway sets PORT; local fallback 8001
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
