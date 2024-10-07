const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const animeflv = require('animeflv-api'); // Importa el paquete npm

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anime')
    .setDescription('Busca información de un anime')
    .addStringOption(option =>
      option.setName('nombre')
        .setDescription('El nombre del anime')
        .setRequired(true)),

  async execute(interaction) {
    try {
      // Verificar si la interacción es de tipo comandos slash
      if (interaction.type !== 'APPLICATION_COMMAND') {
        console.log('Esta interacción no es un comando slash.');
        return;
      }

      // Obtener el nombre del anime desde las opciones de la interacción
      const nombreAnime = interaction.options.getString('nombre');

      // Verificar si se proporcionó el nombre del anime
      if (!nombreAnime) {
        await interaction.reply({
          content: 'Por favor, especifica el nombre del anime que deseas buscar.',
          ephemeral: true
        });
        return;
      }

      // Buscar información del anime utilizando animeflv-api
      const resultado = await animeflv.searchAnime({ query: nombreAnime });
      const informacion = resultado.data[0]; // Tomar el primer resultado

      // Crear el embed con la información del anime
      const embed = new MessageEmbed()
        .setTitle('Información del Anime')
        .setDescription(`Título: ${informacion.title}\nSinopsis: ${informacion.synopsis}`)
        .setThumbnail(informacion.cover)
        .addFields(
          { name: 'Géneros', value: informacion.genres.join(', ') },
          { name: 'Estado', value: informacion.status },
          { name: 'Calificación', value: informacion.rating }
        )
        .setURL(informacion.url);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error al buscar o obtener información del anime:', error);
      await interaction.reply('Ocurrió un error al procesar tu solicitud.');
    }
  },
};
