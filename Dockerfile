FROM node:20-bookworm-slim

ENV PYTHONUNBUFFERED=1
ENV NODE_NO_WARNINGS=1
ENV APP_MODE=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

COPY main/backend/package.json ./main/backend/package.json
RUN cd main/backend && npm install --omit=dev

COPY . .

EXPOSE 3000

WORKDIR /app/main/backend

CMD ["python3", "main.py"]
