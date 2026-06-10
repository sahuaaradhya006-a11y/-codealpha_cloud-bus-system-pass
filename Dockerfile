FROM node:24-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY schema.sql ./

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/bus-pass.sqlite

RUN addgroup -S app && adduser -S app -G app
RUN mkdir -p /data && chown -R app:app /app /data
USER app

EXPOSE 3000
CMD ["node", "src/server.js"]
