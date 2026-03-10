FROM nvidia/cuda:12.1.0-base-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Dépendances système uniquement (pip packages fournis via bind mount)
RUN apt-get update && apt-get install -y \
    python3-pip \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# RUN pip3 install --no-cache-dir -r requirements.txt
# ↑ Commenté : les packages sont montés depuis ~/.local/share/dearvoices/pip-packages
#   Si tu veux un build autonome (CI/CD, autre machine), décommente cette ligne.

COPY . .

RUN mkdir -p /app/uploads /app/outputs

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
