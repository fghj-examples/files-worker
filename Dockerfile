FROM node:24-alpine
# sharp renders SVG through librsvg, which needs fonts for any <text>.
RUN apk add --no-cache fontconfig font-dejavu
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/worker.ts"]
