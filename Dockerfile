# Copyright by AcmaTvirus
FROM node:18-alpine

WORKDIR /app

# Cài đặt các gói cần thiết để build (nếu có native modules)
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm install

COPY . .

# Build TypeScript sang JavaScript
RUN npm run build

# Chạy bot bằng file manager đã build
CMD ["node", "dist/manager.js"]
