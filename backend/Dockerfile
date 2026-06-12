FROM node:20

# Install dependencies (curl, python3, pip, serial)
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    python3-serial \
    && rm -rf /var/lib/apt/lists/*

# Install arduino-cli
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | BINDIR=/usr/local/bin sh

# Setup configuration & additional board index URLs
ENV ARDUINO_CLI_PATH=/usr/local/bin/arduino-cli
RUN arduino-cli config init && \
    arduino-cli core update-index --additional-urls "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json,https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json,https://www.pjrc.com/teensy/package_teensy_index.json"

# Pre-install cores to speed up runtime compilation
RUN arduino-cli core install arduino:avr
RUN arduino-cli core install esp32:esp32 --additional-urls "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json"
RUN arduino-cli core install rp2040:rp2040 --additional-urls "https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json"
RUN arduino-cli core install teensy:avr --additional-urls "https://www.pjrc.com/teensy/package_teensy_index.json"

# Create application directory
WORKDIR /app

# Copy application configuration and dependency locks
COPY package*.json tsconfig.json ./

# Install application dependencies
RUN npm ci

# Copy application source
COPY src/ ./src/

# Build the TypeScript application
RUN npm run build

# Expose server port
EXPOSE 5000

# Set default env variables for deployment
ENV PORT=5000
ENV NODE_ENV=production
ENV FORMULATION_EXPORTS_DIR=/tmp/wireup_formulation_exports

# Start command
CMD ["npm", "start"]
