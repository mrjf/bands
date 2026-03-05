FROM oven/bun:1-alpine
WORKDIR /app
COPY server.ts .
RUN bun add hono
EXPOSE 9000
CMD ["bun", "run", "server.ts"]
