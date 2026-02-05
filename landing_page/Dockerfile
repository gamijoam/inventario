# Production Dockerfile for Static Landing Page
FROM nginx:alpine

# Copy static files to the Nginx html directory
COPY . /usr/share/nginx/html

# Expose port (Nginx default)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
