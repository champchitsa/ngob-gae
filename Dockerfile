FROM node:24-alpine

RUN apk add --no-cache tini

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4317
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "dev:docker"]
