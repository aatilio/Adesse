# Usamos Node 22 (LTS) para máxima estabilidad
FROM node:22-slim

WORKDIR /app

# Copiamos archivos de dependencias
COPY package*.json ./

# Instalamos dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos el puerto de Vite
EXPOSE 5173

# IMPORTANTE: Usamos --host para que Docker pueda mapear el puerto correctamente
CMD ["npm", "run", "dev", "--", "--host"]