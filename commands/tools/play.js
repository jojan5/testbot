const { SlashCommandBuilder } = require("@discordjs/builders")
//const { MessageEmbed } = require("discord.js")
const { QueryType } = require("discord-player")
const { EmbedBuilder } = require('discord.js');
const Discord = require('discord.js');
const wait = require('node:timers/promises').setTimeout;

module.exports = {
	data: new SlashCommandBuilder()
		.setName("play")
		.setDescription("creo que es obvio que le da play a una cancion :[")
		.addSubcommand(subcommand =>
			subcommand
				.setName("search")
				.setDescription("busca por una cancion da")
				.addStringOption(option =>
					option.setName("searchterms").setDescription("search keywords").setRequired(true)
				)
		)
        .addSubcommand(subcommand =>
			subcommand
				.setName("playlist")
				.setDescription("toca una playlist de YT")
				.addStringOption(option => option.setName("url").setDescription("the playlist's url").setRequired(true))
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName("song")
				.setDescription("toca una cancion de  YT")
				.addStringOption(option => option.setName("url").setDescription("the song's url").setRequired(true))
		),
	execute: async ({ client, interaction }) => {

        try {
            await returnsPromise()
          } catch (error) {
            console.log('That did not go well.')
          }
        // Make sure the user is inside a voice channel
		if (!interaction.member.voice.channel) return interaction.reply("Necesitas estar en un canal de voz");

        // Create a play queue for the server
		const queue = await client.player.createQueue(interaction.guild);

        // Wait until you are connected to the channel
		if (!queue.connection) await queue.connect(interaction.member.voice.channel)

		let embed = new EmbedBuilder()
        //const embed = new EmbedBuilder();

		if (interaction.options.getSubcommand() === "song") {
            let url = interaction.options.getString("url")
            
            // Search for the song using the discord-player
            const result = await client.player.search(url, {
                requestedBy: interaction.user,
                searchEngine: QueryType.YOUTUBE_VIDEO
            })

            // finish if no tracks were found
            if (result.tracks.length === 0)
                return interaction.reply("sin resultados")

            // Add the track to the queue
            const song = result.tracks[0]
            await queue.addTrack(song)
            embed
                .setDescription(`**[${song.title}](${song.url})** a sido agregada a la lista`)
                .setThumbnail(song.thumbnail)
                .setFooter({ text: `Duration: ${song.duration}`})

		}
        else if (interaction.options.getSubcommand() === "playlist") {

            // Search for the playlist using the discord-player
            let url = interaction.options.getString("url")
            const result = await client.player.search(url, {
                requestedBy: interaction.user,
                searchEngine: QueryType.YOUTUBE_PLAYLIST
            })

            if (result.tracks.length === 0)
            return interaction.reply(`No playlists found with ${url}`)
        
        // Add the tracks to the queue
        const playlist = result.playlist
        await queue.addTracks(result.tracks)
        embed
            .setDescription(`**${result.tracks.length} songs from [${playlist.title}](${playlist.url})** have been added to the Queue`)
            .setThumbnail(playlist.thumbnail)


		} 
        else if (interaction.options.getSubcommand() === "search") {

            // Search for the song using the discord-player
            let url = interaction.options.getString("searchterms")
            const result = await client.player.search(url, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO
            })

            // finish if no tracks were found
            if (result.tracks.length === 0)
                return interaction.editReply("sin resultados")
            
            // Add the track to the queue
            const song = result.tracks[0]
            await queue.addTrack(song)
            embed
                .setDescription(`**[${song.title}](${song.url})** ha sido agregado a la espera`)
                .setThumbnail(song.thumbnail)
                .setFooter({ text: `Duracion ${song.duration}`})
		}

        // Play the song
        if (!queue.playing) await queue.play()
        
        
        // Respond with the embed containing information about the player
        //await interaction.deferReply({ ephemeral: true });

        //interaction.response.defer({ embeds: [embed] })
     /*   await interaction.reply();
        await wait(2000);

        await interaction.editReply({ embeds: [embed]});
*/
//interaction.deferReply('buscando musica de youtube onii-san')
//This will then wait for you to run through whatever logic you need and follow up with:
await interaction.reply('buscando musica de youtube onii-san');
//const result = await YOUR_FUNCTION();
await interaction.followUp({ embeds: [embed] });

//await wait(2900);
 //await interaction.editReply({ embeds: [embed] })
	},
    
}