FROM node:20-slim

# FFmpegと必要な依存関係をインストール
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pythonのキャッシュファイルを作成しないように環境変数を設定
ENV PYTHONDONTWRITEBYTECODE=1

COPY backend/package*.json ./

RUN npm install

COPY backend/ .
COPY backend/.env .

# 既存のPythonキャッシュファイルを削除
RUN find . -type d -name "__pycache__" -exec rm -rf {} +

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]