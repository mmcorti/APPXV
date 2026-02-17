# Multi-stage build for small image size
# BUILD STAGE
FROM node:20 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build frontend (generates dist/)
RUN npm run build

# RUNTIME STAGE
FROM node:20-slim

WORKDIR /app

# Copy production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy server code
COPY server/ ./server/
# Copy built frontend
COPY --from=builder /app/dist/ ./dist/

# Expose port (Cloud Run uses $PORT)
ENV PORT=8080
EXPOSE 8080

# Use node instead of nodemon in production
CMD ["node", "server/index.js"]
