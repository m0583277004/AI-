FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache curl ca-certificates

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
