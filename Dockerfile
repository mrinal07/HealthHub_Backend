# Description: Dockerfile for nodejs
From node

# Create app directory
WORKDIR /app

# Copy all files to the working directory
COPY . .

# Install dependencies (if applicable)
RUN npm install

# Expose port 5000 (check this port whether it already in use or not)
EXPOSE 5000

# Run the server (assuming it's a Node.js app)
CMD ["npm", "start"]