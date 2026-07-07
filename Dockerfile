FROM oven/bun:1
WORKDIR /app
COPY server.ts .
COPY public ./public
EXPOSE 3033
CMD ["bun", "run", "server.ts"]
