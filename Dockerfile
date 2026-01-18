FROM node:20-alpine AS fe
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS be
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY --from=fe /app/frontend/dist /app/frontend/dist

ENV FRONT_DIST=/app/frontend/dist
ENV PORT=8080

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]


