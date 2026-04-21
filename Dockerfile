FROM node:20-alpine

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]