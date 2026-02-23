# Use Node.js 20 Alpine for a small application footprint
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files first to leverage Docker cache for npm install
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port (7860 target for HF spaces, but standard 3000 mapping internally)
EXPOSE 7860

# Define the command to run the app
CMD ["node", "index.js"]
