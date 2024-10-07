const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const fs = require('fs');
const path = require('path');

const deployCommands = async () => {
    const commands = [];

    // Ruta al directorio donde se encuentran los comandos
    const directorioComandos = path.join(__dirname, 'commands');

    try {
        // Verificar si el directorio de comandos existe
        if (!fs.existsSync(directorioComandos)) {
            console.log(`Directorio de comandos (${directorioComandos}) no encontrado.`);
            process.exit(1);
        }

        // Leer todos los archivos (comandos) en el directorio de comandos
        const archivosComandos = fs.readdirSync(directorioComandos);

        // Iterar a través de cada archivo de comando
        for (const archivo of archivosComandos) {
            const rutaArchivo = path.join(directorioComandos, archivo);

            try {
                // Intentar requerir el archivo de comando
                const comando = require(rutaArchivo);

                // Verificar si el módulo requerido tiene las propiedades necesarias
                if (comando && comando.data) {
                    commands.push(comando.data.toJSON());
                } else {
                    console.log(`[ADVERTENCIA] El archivo ${rutaArchivo} no contiene un comando válido.`);
                }
            } catch (error) {
                console.log(`[ERROR] Falló al cargar el comando desde el archivo ${rutaArchivo}:`, error);
            }
        }

        // Crear un nuevo cliente REST y desplegar los comandos
        const rest = new REST({ version: '10' }).setToken(token);
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );

        console.log(`Se desplegaron exitosamente ${data.length} comandos de aplicación (/).`);
    } catch (error) {
        console.error('Ocurrió un error durante el despliegue:', error);
    }
};

// Llamar a la función para desplegar los comandos
deployCommands();