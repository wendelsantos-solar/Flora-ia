FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci --cache /tmp/npm-cache && rm -rf /tmp/npm-cache
COPY . .
ARG NEXT_PUBLIC_FLORA_WSS_A
ARG NEXT_PUBLIC_FLORA_WSS_B
ENV NEXT_PUBLIC_FLORA_WSS_A=$NEXT_PUBLIC_FLORA_WSS_A NEXT_PUBLIC_FLORA_WSS_B=$NEXT_PUBLIC_FLORA_WSS_B
RUN npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
ENV HOSTNAME=0.0.0.0 PORT=3000
CMD ["node", "server.js"]
