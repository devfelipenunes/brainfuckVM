FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Foundry
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:${PATH}"
RUN foundryup

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Pre-install dependencies to speed up startup
RUN cd frontend && npm install

# Ensure script is executable
RUN chmod +x up.sh

# Expose Vite and Anvil ports
EXPOSE 5173 8545

# Start the all-in-one script
CMD ["./up.sh"]
