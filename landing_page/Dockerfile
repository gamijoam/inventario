# Production Dockerfile for Static Landing Page
FROM nginx:alpine

# Recibimos la variable desde el script .bat
ARG VITE_API_URL

# Copiamos los archivos estáticos
COPY . /usr/share/nginx/html

# ⚠️ AQUÍ ESTÁ EL CAMBIO CLAVE:
# Buscamos "__API_URL_PLACEHOLDER__" y lo reemplazamos por la variable real.
# Esto es mucho más seguro porque esa palabra no existe naturalmente en el código.

RUN find /usr/share/nginx/html -type f \( -name "*.html" -o -name "*.js" \) -exec sed -i "s|__API_URL_PLACEHOLDER__|$VITE_API_URL|g" {} +

# Note: nginx master process requires root for port 80 binding.
# Worker processes already run as non-root 'nginx' user via nginx.conf default.

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]