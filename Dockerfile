# Use the official Nginx image from the Docker Hub
FROM nginx:alpine

# Copy the game files to the Nginx web server directory
COPY . /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 to allow external access
EXPOSE 80

# Start Nginx when the container launches
CMD ["nginx", "-g", "daemon off;"]
