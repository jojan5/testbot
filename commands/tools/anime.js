const { SlashCommandBuilder, MessageEmbed } = require('@discordjs/builders');
const animeflv = require('animeflv-api');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buscaanime')
    .setDescription('Busca información de un anime')
    .addStringOption(option =>
      option.setName('nombre')
        .setDescription('El nombre del anime que deseas buscar')
        .setRequired(true)),

  async execute(interaction) {
    try {
   
      if (!interaction.isCommand()) {
        console.error('Esta interacción no es un comando slash.');
        return;
      }

      if (interaction.commandName !== 'buscaanime') {
        console.error('Nombre del comando incorrecto:', interaction.commandName);
        return;
      }


      const nombreAnime = interaction.options.getString('nombre');

     
      if (!nombreAnime) {
        await interaction.reply({
          content: 'Por favor, especifica el nombre del anime que deseas buscar.',
          ephemeral: true
        });
        return;
      }

      
      const resultado = await animeflv.searchAnime({ query: nombreAnime });
      const informacion = resultado.data[0]; 

    
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