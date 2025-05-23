# Generated by https://smithery.ai. See: https://smithery.ai/docs/build/project-config
FROM node:lts-alpine

# Install Python for the bridging script
RUN apk add --no-cache python3

WORKDIR /app

# Copy package files and TypeScript config
COPY package*.json tsconfig.json ./

# Install deps without running build scripts
RUN npm install --ignore-scripts

# Copy source files
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose nothing; this is a stdio server

# Entry point runs the Python bridge which launches the Node server
ENTRYPOINT ["python3", "bridging_mail_mcp.py"]
