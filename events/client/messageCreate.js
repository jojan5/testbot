const { ButtonBuilder } = require("@discordjs/builders")
const { ActionRowBuilder, ButtonStyle } = require("discord.js")
const profanity = require('../../profanity.js');
// ⬆️⬇️✅⛔⚒️
module.exports = {
    name: "messageCreate",
    async execute(message, client, fns) {
        console.log(message)
        console.log(message.channel)
        if(message.author.bot) return;
        const users = message.mentions.users.map((user) => user.id);
        // const userTags = message.mentions.users.map((user) => user.tag);
        const disallowedUsers = [];
        if(process.env.TESTING && message.guildId == process.env.guildId && process.env.PROFANITY_DISABLED && profanity.some(word=>message.content.includes(word))) {
            await message.delete();
            await message.author.send('Please do not say that here!')
        }
        for(let i = 0;i < users.length;i++) {
            let user = users[i];
            let isAllowed = true;
            try {
                let userPingData = await fns.get(`AllowPings_${user}`);
                isAllowed = userPingData.data == 'false' ? false : true;
            } catch {
                isAllowed = true;
            }
            if(!isAllowed) {
                disallowedUsers.push(users[i]);
            }
        }
        if(disallowedUsers.length) {
            await message.reply({
                embeds: [
                    {
                        title: `${disallowedUsers.length} user${disallowedUsers.length > 1 ? "s has" : " has"} pings disabled`,
                        description: `Users: <@${disallowedUsers.join(">, <@")}>`,
                        color: 0xff4400
                    }
                ]
            })
        }
        if(message.channelId == '1059338598123589662' || message.channelId == '922867510695559188') {
            let currentSuggestionCount = await fns.get('SuggestionCount-'+message.guildId);
            if(currentSuggestionCount.data) {
                await fns.put('SuggestionCount-'+message.guildId, currentSuggestionCount.data + 1)
            } else {
                await fns.put('SuggestionCount-'+message.guildId, 2)
            }
            let btn = new ButtonBuilder()
                .setCustomId('accept')
                .setLabel('Done')
                .setStyle(ButtonStyle.Success);
            let btn2 = new ButtonBuilder()
                .setCustomId('deny')
                .setLabel('Deny')
                .setStyle(ButtonStyle.Danger);
            let btn3 = new ButtonBuilder()
                .setCustomId('underconstruction')
                .setLabel('Under Construction')
                .setStyle(ButtonStyle.Secondary)
            let msg = await message.channel.send({
                embeds: [
                    {
                        color: 0xff5500,
                        title: `Suggestion #${currentSuggestionCount.data ?? 1}`,
                        description: message.content,
                        footer: {
                            text: "Status: Pending"
                        },
                        author: {
                            name: message.author.tag
                        }
                    }
                ],
                components: [new ActionRowBuilder().addComponents(btn).addComponents(btn2).addComponents(btn3)]
            });
            await msg.react('⬆️')
            await msg.react('⬇️');
            await message.delete();
        }
    }
}