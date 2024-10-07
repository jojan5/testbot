module.exports = {
    data: {
        name: "underconstruction"
    },
    async execute(interaction, client) {
        if(interaction.member.permissions.has('Administrator') || interaction.member.permissions.has('ManageGuild')) {
            let embed = interaction.message.embeds[0].data;
            embed.color = 0x00ffff;
            embed.footer.text = "Status: Under Construction"
            await interaction.message.edit({
                embeds: [embed]
            })
            await interaction.reply({
                content: "Suggestion now marked as under construction!",
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