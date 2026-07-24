FROM python:3.12-slim

WORKDIR /app

COPY server.py ./
COPY extension/app ./extension/app

ENV PYTHONUNBUFFERED=1

# Cloud Run provides $PORT; server.py reads it when no CLI arg is given.
CMD ["python", "server.py"]
