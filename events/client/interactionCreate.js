module.exports = {
    name: "interactionCreate",
    async execute(interaction, client, fns) {
        if(interaction.isChatInputCommand()) {
            const { commands } = client;
            const { commandName } = interaction;
            const command = commands.get(commandName);
            if(!command) return;
            
            try {
                await command.execute(interaction, client, fns);
            } catch(error) {
                console.error(error);
                await interaction.reply({
                    content: "Something went wrong while executing the command",
                    ephemeral: true
                })
            }    
        } else if(interaction.isButton()) {
            const { buttons } = client;
            const { customId } = interaction;
            const button = buttons.get(customId);
            if(!button) return new Error('Idiot\nCatastrophic failure');

            try {
                await button.execute(interaction, client);
            } catch(e) {
                console.error(err);
            }
        }
    }
}