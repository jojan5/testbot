const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeCharacterArtifacts(personaje) {
    try {
        const response = await axios.get(`https://paimon.moe/characters/${personaje}`, {
            headers: {
                'Accept-Language': 'es-ES,es;q=0.9'
            }
        });
        const $ = cheerio.load(response.data);

        const artifacts = [];

        $('div.flex.mb-1.svelte-ti79zj').each((index, element) => {
            const nameText = $(element).find('.font-bold.text-primary.text-sm').text().trim();
            const nameMatch = nameText.match(/(\d Set [^0-9]+)/); // Encuentra solo el primer conjunto de bonificación
            const name = nameMatch ? nameMatch[1] : nameText; // Usa solo el primer conjunto de bonificación
            const descriptionText = $(element).find('.text-gray-900.text-sm.svelte-ti79zj').text().trim();
            const descriptionMatch = descriptionText.match(/.*?(?:\.|%)/); // Encuentra hasta el primer punto o el primer símbolo de porcentaje
            const description = descriptionMatch ? descriptionMatch[0] : descriptionText; // Usa solo la parte de la descripción hasta el primer punto o símbolo de porcentaje
            
            const name2Match = nameText.match(/(?:\d Set [^0-9]+)(.*)/); // Encuentra lo que sigue después del primer conjunto de bonificación
            const name2 = name2Match ? name2Match[1] : ''; // Usa lo que sigue después del primer conjunto de bonificación
            const description2Match = descriptionText.match(/(?:\.|%)(.*)/); // Encuentra lo que sigue después del primer punto o símbolo de porcentaje
            const description2 = description2Match ? description2Match[1].slice(0, -1) : ''; // Usa lo que sigue después del primer punto o símbolo de porcentaje y elimina el último carácter
            
            const imageSrc = $(element).find('img').attr('src');

            artifacts.push({ name, description, name2, description2, imageSrc });
        });

        console.log('Artefactos extraídos:', artifacts);

        return {
            artifacts,
            imageName: personaje
        };
    } catch (error) {
        console.error('Error al obtener información de los artefactos:', error);
        throw error;
    }
}

async function handleGenshinArtefactos(interaction) {
    const personaje = interaction.options.getString('artefacto');
    let embedNumber = 1;
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);
    await interaction.deferReply();

    try {
        const { artifacts, imageName } = await scrapeCharacterArtifacts(personaje);

        for (const artifact of artifacts) {
            const embed = new EmbedBuilder()
                .setTitle(`${personaje} - Mejores artefactos enumerados ${embedNumber}`)
                .setThumbnail(`https://paimon.moe/images/characters/full/${personaje}.png`)
                .setColor(`#${randomColor}`)
                .setImage(`https://paimon.moe${artifact.imageSrc}`)
                .setFooter({ text: 'thx to paimon.moe' });

            let descriptionText = '';

            if (artifact.description && artifact.description.length >= 3) { // Verificar si la descripción 1 no está vacía y tiene al menos 3 caracteres
                descriptionText += `**Sets posibles: de 2** ${artifact.name}\n**Descripción:** ${artifact.description}\n\n`;
            }

            if (artifact.description2) { // Verificar si la descripción 2 no está vacía
                descriptionText += `**Sets posibles: de 4** ${artifact.name2}\n**Descripción:** ${artifact.description2}`;
            }

            if (descriptionText.trim() !== '') { // Verificar si la descripción final no está vacía
                embed.setDescription(descriptionText);
                await interaction.followUp({ embeds: [embed] });
                embedNumber++;
            }
        }
    } catch (error) {
        console.error('Error al procesar el comando:', error);
        await interaction.followUp(`¡Hubo un error al procesar la solicitud de los artefactos para ${personaje}`);
    }
}

module.exports = {
    handleGenshinArtefactos
};
