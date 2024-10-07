module.exports = {
    data: {
        name: "accept"
    },
    async execute(interaction, client) {

        if(interaction.member.permissions.has('Administrator') || interaction.member.permissions.has('ManageGuild')) {
            let embed = interaction.message.embeds[0].data;
            embed.color = 0x00ff00;
            embed.footer.text = "Status: Done"
            await interaction.message.edit({
                embeds: [embed]
            })
            await interaction.reply({
                content: "Suggestion now marked as done!",
                ephemeral: true
            })
        } else {
            await interaction.reply({
                content: "You don't have permissions to do that!",
                ephemeral: true
            })
        }
    }
}