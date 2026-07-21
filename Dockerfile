# Use standard Node base image (no browser required, keeping build fast and small)
FROM node:20-slim

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install packages
RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional

# Copy source code
COPY . .

# Launch command
CMD ["npm", "start"]
