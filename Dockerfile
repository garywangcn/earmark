FROM python:3.12-slim

WORKDIR /app

COPY server.py index.html app.js helpers.js store.js style.css ./

ENV PYTHONUNBUFFERED=1

# Cloud Run provides $PORT; server.py reads it when no CLI arg is given.
CMD ["python", "server.py"]
