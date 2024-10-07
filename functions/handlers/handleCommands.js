const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

module.exports = (client)=> {
    client.handleCommands = async() => {
        const commandFolders = fs.readdirSync('./commands');
        for(const folder of commandFolders) {
            const commandFiles = fs.readdirSync('./commands/'+folder).filter(file=>file.endsWith('.js'));
            for(const file of commandFiles) {
                const command = require('../../commands/'+folder+'/'+file);
                client.commands.set(command.data.name, command);
                client.commandArray.push(command.data.toJSON())
                console.log('Command: '+command.data.name+ 'has been passed through the handler');
            }
        }

        // const clientId = '881016039377367040';
        // const guildId = '1025167265747963924';
        const clientId = process.env.clientId;
        const guildId = process.env.guildId;
        const rest = new REST({ version: '9' }).setToken(process.env.token);
        try {
            console.log("Started refreshing application (/) commands.");

            await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
                body: client.commandArray
            })

            console.log("Successfully reloaded application (/) commands.");
        } catch(error) {
            console.error(error);
        }
    }
}