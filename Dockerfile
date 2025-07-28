FROM node:18-alpine

WORKDIR /app

# Instalar Docker CLI para control de containers
RUN apk add --no-cache docker-cli

COPY package*.json ./
RUN npm install

COPY . .

# Crear directorios necesarios
RUN mkdir -p /workspace /app/data

EXPOSE 3000

CMD ["npm", "start"]