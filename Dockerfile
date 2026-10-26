FROM node:22-alpine
WORKDIR /app
COPY stdio.mjs package.json ./
ENTRYPOINT ["node", "stdio.mjs"]
