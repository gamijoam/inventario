# ETAPA 1: Construcción (Build)
FROM node:22-alpine AS build

WORKDIR /app

# Copiamos dependencias primero (para aprovechar caché de Docker)
COPY package*.json ./
RUN npm install

# Copiamos el resto del código
COPY . .

# Recibimos la variable de entorno desde el script de tu PC
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Construimos la app (Genera la carpeta dist)
RUN npm run build

# ETAPA 2: Servidor (Production)
FROM nginx:alpine

# Copiamos el build de la etapa anterior a la carpeta de Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copiamos nuestra configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Note: nginx master process requires root for port 80 binding.
# Worker processes already run as non-root 'nginx' user via nginx.conf default.

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]