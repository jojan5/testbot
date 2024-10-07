module.exports = {
    data: {
        name: "schoolishell"
    },
    async execute(interaction, client) {
        await interaction.reply({
            content: '...porque pones eso'
        })
    }
}