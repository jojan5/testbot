# Usa la imagen oficial de Node.js como base
FROM node:16

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos del proyecto al contenedor
COPY package*.json ./

# Instala las dependencias de la aplicación
RUN npm install --production

# Copia el resto de los archivos de tu proyecto
COPY . .

# Expone el puerto que usa tu bot (ajústalo si es necesario)
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "index.js"]
