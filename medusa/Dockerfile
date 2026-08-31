FROM node:22.23.2-bookworm-slim

WORKDIR /medusa

COPY package.json package-lock.json .npmrc ./
COPY apps/backend/package.json ./apps/backend/

RUN npm ci

COPY . .

EXPOSE 9000 5173

CMD ["npm", "--workspace=@dtc/backend", "run", "dev", "--", "--host", "0.0.0.0"]