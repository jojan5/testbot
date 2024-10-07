const {SlashCommandBuilder} = require("@discordjs/builders");
const { EmbedBuilder } = require('discord.js');



module.exports = {
    data: new SlashCommandBuilder()
    .setName("caca")
    .setDescription("te muestra las primeras 10 canciones en la lista"),
    execute : async ({client,interaction})=> {
        const queue = client.player.getQueue(interaction.guild);

        if (!queue || !queue.playing){

            await interaction.reply("no hay ninguna cancion tocando"); 
            return;
        }

        const queueString = queue.tracks.slice(0,10).map((song, i) =>{
            return `${i + 1}) [${song.duration}]\` ${song.title} -<@${song.requestedBy.id}>`;
        }).join("\n");

        const currentSong= queue.current;

        await interaction.reply({
            embeds :[
                new EmbedBuilder()
                .setDescription(`**ahora tocando**\n\` ${currentSong.title} - <@${currentSong.requestedBy.id}>\n\n** en espera:**\n${queueString}`)
                .setThumbnail(currentSong.thumbnail)
            ]
        })
    }
}