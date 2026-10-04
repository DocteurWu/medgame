# Use the official Nginx image from the Docker Hub
FROM nginx:alpine

# Copy the game files to the Nginx web server directory
COPY . /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install the shared security-header snippet (included by every location in
# nginx.conf, since a location-level add_header cancels the inherited ones)
RUN mkdir -p /etc/nginx/snippets
COPY nginx-security.conf /etc/nginx/snippets/medgame-security.conf

# Validate the configuration at build time: a broken nginx.conf must fail the
# build, not the container start
RUN nginx -t

# Pre-compress static files to save CPU at runtime (preserving timestamps for gzip_static)
RUN find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.css" -o -name "*.json" -o -name "*.html" -o -name "*.edge" \) -exec sh -c 'gzip -9 -c "$1" > "$1.gz" && touch -r "$1" "$1.gz"' _ {} \;

# Expose port 8888 to allow external access
EXPOSE 8888

# Start Nginx when the container launches
CMD ["nginx", "-g", "daemon off;"]
