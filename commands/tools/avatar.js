const { SlashCommandBuilder,EmbedBuilder,ButtonBuilder,ButtonStyle,ActionRowBuilder } = require("discord.js")

module.exports={

    data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("muestra el avatar")
    .addUserOption((option) =>option.setName('user')
    .setDescription("muestra")
    .setRequired(true)
    ),
    async execute(interaction,oldPresence, newPresence, ){

        const user = interaction.options.get('user')?.user || interaction.user;
        //let user = options.getUser("user") || user;
        const { channel, client,options,member } = interaction;
       //const user = interaction.options.getUser(`target`) || interaction.user;
      //const user = interaction.options.getUser('target');
      //const user = interaction.options.getUser('user')
      let userAvatar = user.displayAvatarURL({size:512});

        const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle(`${user.tag}'s avatar.`)
        .setImage(`${userAvatar}`)
        .setTimestamp();

        const buttton = new ButtonBuilder()
        .setLabel("avatar link")
        .setStyle(ButtonStyle.Link)
        .setURL(`${user.avatarURL({size:512})}'s avatar.`);

        const row= new ActionRowBuilder() .addComponents(button);

        await interaction.reply({

            embeds:[embed],
            components: [row],
        })

    }
    
};