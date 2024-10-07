const {SlashCommandBuilder} = require("@discordjs/builders");
const {MessageEmbed} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
    .setName("exit")
    .setDescription("se sale del chat de voz"),
    execute: async ({client,interaction}) => {

const queue = client.player.getQueue(interaction.guild);

if (!queue){
    await interaction.reply("No hay ninguna cancion reproduciendose ");
    return;
}

const currentsong =  queue.current;

queue.destroy;

await interaction.reply("Porque me molestas baka");
}
}