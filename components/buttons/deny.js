module.exports = {
    data: {
        name: "deny"
    },
    async execute(interaction, client) {

        if(interaction.member.permissions.has('Administrator') || interaction.member.permissions.has('ManageGuild')) {
            let embed = interaction.message.embeds[0].data;
            embed.color = 0xff0000;
            embed.footer.text = "Status: Denied"
            await interaction.message.edit({
                embeds: [embed]
            })
            await interaction.reply({
                content: "Suggestion denied",
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