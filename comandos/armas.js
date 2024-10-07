const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeCharacterInfo(arma) {
    try {
        const response = await axios.get(`https://paimon.moe/characters/${arma}`, {
            headers: {
                'Accept-Language': 'es-ES,es;q=0.9'
            }
        });
        const $ = cheerio.load(response.data);

        const weapons = [];

        $('a.popup.flex.mb-1.svelte-ti79zj').each((index, element) => {
            const nameMatch = $(element).find('.font-bold.text-primary.text-sm').text().trim().match(/(.+?)\s*ATK/);
            let name = '';
            if (nameMatch && nameMatch.length > 1) {
                name = nameMatch[1].trim();
            }
            const description = $(element).find('.text-gray-900.text-sm.break-words').text().trim();
            const attack = $(element).find('.text-gray-900.text-sm.svelte-ti79zj').eq(1).text().trim();
            const energyRechargeMatch = $(element).find('.font-bold.text-primary.text-sm').text().trim().match(/ATK\s*(.+)/);
            let energyRecharge = '';
            if (energyRechargeMatch && energyRechargeMatch.length > 1) {
                energyRecharge = energyRechargeMatch[1].trim();
            }
            const imageSrc = $(element).find('img').attr('src');
            const weaponName = $(element).find('span').text().trim();
            const seconf2per = $(element).find('.text-gray-900.text-sm.svelte-ti79zj').eq(2).text().trim();

            weapons.push({ name, description, attack, energyRecharge, imageSrc, weaponName, seconf2per });
        });

        console.log('Armas extraídas:', weapons);

        if (weapons.length === 0) {
            throw new Error('No se encontraron armas para este personaje.');
        }

        return {
            weapons,
            imageName: arma
        };
    } catch (error) {
        console.error('Error al obtener información:', error);
        throw error;
    }
}

async function handleGenshinArmas(interaction) {
    const arma = interaction.options.getString('arma');
    let embedNumber = 0; // Inicializa el contador de embeds

    await interaction.deferReply();

    try {
        const { weapons, imageName } = await scrapeCharacterInfo(arma);
        const randomColor = Math.floor(Math.random()*16777215).toString(16);

        for (const weapon of weapons) {
            if (embedNumber >= 3) break; // Detener el bucle si se han enviado 3 embeds

            const embed = new EmbedBuilder()
                .setTitle(`${arma} - mejores armas enumeradas  ${embedNumber + 1}`)
                .setDescription(`**${weapon.name}**\n**Descripción:** ${weapon.description}\n\n**Ataque:** ${weapon.attack}\n**Bono stat secundario:** ${weapon.energyRecharge} =${weapon.seconf2per}`)
                .setThumbnail(`https://paimon.moe/images/characters/full/${arma}.png`)
                .setColor(`#${randomColor}`)
                .setImage(`https://paimon.moe${weapon.imageSrc}`)
                .setFooter({ text: 'thx to paimon.moe' })

            await interaction.followUp({ embeds: [embed] });
            embedNumber++;
        }
    } catch (error) {
        console.error('Error al procesar el comando:', error);
        if (error.message.includes('No se encontraron armas para este personaje.')) {
            await interaction.followUp(`No se encontraron armas para el personaje. Por favor, espera a que se actualice: ${arma}.`);
        } else {
            await interaction.followUp(`¡Hubo un error al procesar la solicitud del arma ${arma}`);
        }
    }
}

module.exports = {
    handleGenshinArmas
};
