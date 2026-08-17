
require("dotenv").config();//----------------------------------------------------------------

var level = require('level').Level;
const { REST } = require('@discordjs/rest');
var db = new level('db');

const { createCanvas, loadImage } = require('canvas');
const { AttachmentBuilder } = require('discord.js');


const MARVEL_API_KEY = process.env.MARVEL_RIVALS_API_KEY;



function dbDel(key) {
    return new Promise((resolve, reject)=> {
        db.del(key, (err)=>{
            resolve({err});
        })
    })
}
function dbPut(key, val) {
    return new Promise((resolve, reject)=>{
        db.put(key, val, (err)=>{
            resolve({err});
        })
    })
}
function dbGet(key) {
    return new Promise((resolve, reject)=>{
        db.get(key, (err,data)=>{
            resolve({err,data});
        })
    })
}

//----------------------------------------------------------------

//------------------------------------------------------------------
const { Mistral } = require('@mistralai/mistralai');
const cheerio = require('cheerio');
//const { Queue } = require('bull');
const { Queue, Worker } = require('bullmq');
const redis = require('redis');
const { createClient } = require('redis');
const { Routes } = require("discord-api-types/v9");
const { Client, Intents, Collection, GatewayIntentBits, Partials, PresenceManager, PermissionsBitField } = require("discord.js");
//const { Player } = require("discord-player");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');


const axios = require('axios');
const { TWITCH_CHANNEL, CHANNEL_LINK_ADVERT } = require('./config/channel.config.js');
const genshin = require("genshin-api")
const colors = require('colors');
const { MessageEmbedBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const Discord = require('discord.js');
const { random } = require('discord.js');
const { MessageActionRow, MessageButton } = require('discord.js');
//const animeflv = require('animeflv-api');
const animeflv = require('animeflv-api'); 
const { SlashCommandBuilder } = require('discord.js');
const {  IntentsBitField } = require('discord.js');
const { ApplicationCommandManager, ApplicationCommandType } = require('discord.js');
const { handleGenshinArmas } = require('./comandos/armas');
const { handleGenshinArtefactos } = require('./comandos/artefactos');
const { handlePlayerMarvel } = require('./comandos/Player.js');
const { handlePlayerFortnite } = require('./comandos/playerf');
const { setChannel, getChannel } = require('./configGive');
const { postFreeGames } = require("./comandos/giveaways");

const exaAnimeScraper = require('exa-anime-scraper');




const client = new Client({

	/* intents: [Intents.FLAGS.GUILDS,
			   Intents.FLAGS.GUILD_MESSAGES,
			   Intents.FLAGS.GUILD_VOICE_STATES]*/

	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildPresences,
		3276799,


	]
	//  , partials :[User,Message.GuildMember, TrheadMember],
})

// Anti-raid / anti-spam (ver security/antiraid.js y *seguridad ayuda)
const antiraid = require('./security/antiraid');
antiraid.init(client);

//-------------------------------------------------------------------------------// ==============================
//  MENSAJES ESPECIALES NAVIDAD / AÑO NUEVO
//  - Usa twitchConfig[guildId].welcomeChannelId como canal principal
//  - Si no hay welcomeChannelId, usa announcementChannelId como respaldo
//  - Se envía 1 vez por año por servidor (se guarda en twitch-config.json)
// ==============================
//----------------------------------------------------------------

////////////////////////////////////////////////////////////////////

client.once("ready", () => {
const GIVE_CHANNEL_FILE = path.join(__dirname, "giveChannel.json");
    console.log(`🤖 Bot listo como ${client.user.tag}`);

    setInterval(async () => {

        console.log("\n================ GIVEAWAY CHECK ================");

        if (!fs.existsSync(GIVE_CHANNEL_FILE)) {
            console.log("❌ No existe giveChannel.json");
            return;
        }

        const data = JSON.parse(fs.readFileSync(GIVE_CHANNEL_FILE));

        const guilds = Object.keys(data);

        if (!guilds.length) {
            console.log("❌ No hay canales configurados");
            return;
        }

        for (const guildId of guilds) {

            const channelId = data[guildId];

            console.log(`🔎 Revisando guild ${guildId} → canal ${channelId}`);

            await postFreeGames(client, guildId, channelId);
        }

    }, 1000 * 60 * 60 * 24); // cada 2 minutos//cada 24 hotas

});
////////////////////////////////////////////////////////////////////////
//-----------------------------------------------------
// Config: cada cuánto revisar (en ms)
const SEASONAL_CHECK_INTERVAL = 60 * 1000; // 1 minuto
//----------------------------------------------------------------
const fs = require('fs');
const path = require('path');

client.commands = new Map();

const commandFiles = fs
  .readdirSync(path.join(__dirname, 'comandos'))
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./comandos/${file}`);
  client.commands.set(command.name, command);
}

//------------------------------------------------------------------
// Datos de los videos
const CHRISTMAS_VIDEO = {
  videoUrl: 'https://youtu.be/qD-W4m-R2U8?si=jdXH7moYpb50m7-t',
  videoId: 'qD-W4m-R2U8',
  title: '🎄 ¡Feliz Navidad! 🎄',
  description: '¡Disfruta de este video y celebra con nosotros la época de paz y amor verdadero!',
  footer: 'Yey, es diciembre',
};

const NEWYEAR_VIDEO = {
  videoUrl: 'https://youtu.be/ANP1V08rxrk',
  videoId: 'ANP1V08rxrk', // ID del video nuevo
  title: '🎉 ¡Feliz Año Nuevo! 🎉🥂',
  description: '¡Mira este video y celebremos juntos el inicio de un nuevo año!',
  footer: 'Yey, es enero',
};

// Día fijo sin importar el año
const CHRISTMAS_DAY = { month: 12, day: 1 }; // 1 de diciembre
const NEWYEAR_DAY = { month: 1, day: 1 };    // 1 de enero

function isToday(month, day) {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return m === month && d === day;
}

async function sendSeasonalMessageToGuild(guildId, type) {
  const cfg = twitchConfig[guildId];
  if (!cfg) return;

  // Aseguramos subobjeto donde guardar los años enviados
  if (!cfg.seasonalMessages) {
    cfg.seasonalMessages = {};
  }

  const now = new Date();
  const currentYear = now.getFullYear();

  if (type === 'christmas') {
    if (cfg.seasonalMessages.lastChristmasYear === currentYear) return; // ya enviado este año

    const channelId =
      cfg.welcomeChannelId ||
      cfg.announcementChannelId;

    if (!channelId) {
      console.log(`[SEASONAL] Servidor ${guildId} no tiene welcomeChannelId ni announcementChannelId.`);
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log(`[SEASONAL] No estoy en el servidor ${guildId}.`);
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.log(`[SEASONAL] El canal ${channelId} no existe en el servidor ${guildId}.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#FFFFFF')
      .setTitle(CHRISTMAS_VIDEO.title)
      .setDescription(CHRISTMAS_VIDEO.description)
      .setURL(CHRISTMAS_VIDEO.videoUrl)
      .setImage(`https://img.youtube.com/vi/${CHRISTMAS_VIDEO.videoId}/0.jpg`)
      .setFooter({ text: CHRISTMAS_VIDEO.footer });

    await channel.send({
      content: '@everyone Ahora estamos en diciembre, ¡festejen mortales la época de paz y verdadero amor!',
      embeds: [embed],
    });

    console.log(`[SEASONAL] Mensaje de Navidad enviado en servidor ${guildId}.`);
    cfg.seasonalMessages.lastChristmasYear = currentYear;
    saveConfig();
  }

  if (type === 'newyear') {
    if (cfg.seasonalMessages.lastNewYearYear === currentYear) return; // ya enviado este año

    const channelId =
      cfg.welcomeChannelId ||
      cfg.announcementChannelId;

    if (!channelId) {
      console.log(`[SEASONAL] Servidor ${guildId} no tiene welcomeChannelId ni announcementChannelId.`);
      return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log(`[SEASONAL] No estoy en el servidor ${guildId}.`);
      return;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
      console.log(`[SEASONAL] El canal ${channelId} no existe en el servidor ${guildId}.`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(NEWYEAR_VIDEO.title)
      .setDescription(NEWYEAR_VIDEO.description)
      .setURL(NEWYEAR_VIDEO.videoUrl)
      .setImage(`https://img.youtube.com/vi/${NEWYEAR_VIDEO.videoId}/0.jpg`)
      .setFooter({ text: NEWYEAR_VIDEO.footer });

    await channel.send({
      content: '@everyone ¡Y próspero Año Nuevo, mortales! 🥂',
      embeds: [embed],
    });

    console.log(`[SEASONAL] Mensaje de Año Nuevo enviado en servidor ${guildId}.`);
    cfg.seasonalMessages.lastNewYearYear = currentYear;
    saveConfig();
  }
}

// Bucle que revisa cada minuto si toca mandar mensaje de Navidad o Año Nuevo
function startSeasonalMessagesScheduler() {
  console.log('[SEASONAL] Iniciando comprobación de mensajes de Navidad / Año Nuevo.');

  const loop = async () => {
    try {
      const now = new Date();
      const guildIds = Object.keys(twitchConfig || {});

      if (guildIds.length === 0) {
        // Sin servidores configurados, no hacemos nada
        return;
      }

      const isChristmasToday = isToday(CHRISTMAS_DAY.month, CHRISTMAS_DAY.day);
      const isNewYearToday = isToday(NEWYEAR_DAY.month, NEWYEAR_DAY.day);

      if (!isChristmasToday && !isNewYearToday) {
        return; // Hoy no toca nada
      }

      for (const guildId of guildIds) {
        if (isChristmasToday) {
          await sendSeasonalMessageToGuild(guildId, 'christmas');
        }
        if (isNewYearToday) {
          await sendSeasonalMessageToGuild(guildId, 'newyear');
        }
      }
    } catch (error) {
      console.error('[SEASONAL] Error en el bucle de mensajes estacionales:', error);
    }
  };

  // Revisar cada minuto
  setInterval(loop, SEASONAL_CHECK_INTERVAL);
}

// ==============================
//  BOT LISTO → INICIAR TWITCH + MENSAJES ESTACIONALES
// ==============================

client.on('ready', async () => {
  console.log(`${client.user.tag} ha sido lanzado, listo para ver los canales de Twitch y mandar mensajes de temporada.`);

  // Arranca el ciclo de Twitch (ya lo tenías)
  checkLiveStatus();

  // Arranca el ciclo de Navidad/Año Nuevo
  startSeasonalMessagesScheduler();

  client.user.setPresence({
    activities: [{ name: 'Espiándolos desde las sombras' }],
    status: 'online',
  });
});

//---------------------------------------------------------------------------------------
//-----------------------------------------------------------------

const commands = [
  antiraid.slashCommand, // /seguridad — auditoría anti-raid
  new SlashCommandBuilder()
    .setName("combate")
    .setDescription("Reta a otro jugador a un combate por turnos.")
    .addUserOption(option =>
      option.setName("oponente")
        .setDescription("Menciona al jugador que deseas retar.")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("si")
    .setDescription("Acepta el desafío."),
  new SlashCommandBuilder()
    .setName("no")
    .setDescription("Rechaza el desafío."),
  new SlashCommandBuilder()
    .setName("carrera")
    .setDescription("Inicia una carrera de emoticones."),
  new SlashCommandBuilder()
    .setName("participar")
    .setDescription("Únete a la carrera activa."),
  new SlashCommandBuilder()
    .setName("mistral")
    .setDescription("Haz una pregunta a Mistral")
    .addStringOption(option =>
      option.setName("consulta")
        .setDescription("Escribe tu consulta")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('navidad')
    .setDescription('Envía los mensajes de Navidad y Año Nuevo'),
  new SlashCommandBuilder()
    .setName('codigos_honkai')
    .setDescription('Obtén los últimos códigos de Honkai: Star Rail'),
  new SlashCommandBuilder()
    .setName('codigos_honkai3d')
    .setDescription('Obtén los últimos códigos de Honkai Impact 3rd'),
  new SlashCommandBuilder()
    .setName('codigosgenshin')
    .setDescription('Obtiene los códigos de Genshin Impact'),
  new SlashCommandBuilder()
    .setName('codigoszzz')
    .setDescription('Obtiene los códigos de Zenless Zone Zero (Nap)'),
	//--------------

    // en tu registro de comandos test chat gpt
new SlashCommandBuilder()
  .setName('setgiveawaychannel')
  .setDescription('Configura el canal para los giveaways')
  .addChannelOption(option =>
    option
      .setName('canal')
      .setDescription('Selecciona el canal')
      .setRequired(true)
  )
  .toJSON(),
  //---------------------------------------------------------



  new SlashCommandBuilder()
    .setName('anime')
    .setDescription('Busca un anime en AnimeFLV.')
    .addStringOption(option => 
      option.setName('nombre-anime')
        .setDescription('El nombre del anime que deseas buscar.')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('buscaranime')
    .setDescription('Searches for information about the anime buscaranime.')
    .addStringOption(option => 
      option.setName('nombre-anime')
        .setDescription('El nombre del anime que deseas buscar.')
        .setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('genshinarmas')
    .setDescription('Obtiene información sobre las mejores armas del personaje que elijas lo toma de paimon.moe')
    .addStringOption(option =>
      option.setName('arma')
        .setDescription('Obtén las mejores armas del personaje que selecciones')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('genshinartefactos')
    .setDescription('Obtiene información sobre los artefactos del personaje que elijas lo toma de paimon.moe')
    .addStringOption(option =>
      option.setName('artefacto')
        .setDescription('Obtén información sobre los artefactos del personaje seleccionado')
        .setRequired(true)),

new SlashCommandBuilder()
  .setName('playermarvel')
  .setDescription('Muestra perfil visual de Marvel Rivals')
  .addStringOption(option =>
    option.setName('username')
      .setDescription('Nombre del jugador')
      .setRequired(true)
  ),

new SlashCommandBuilder()
  .setName('playerfortnite')
  .setDescription('Muestra perfil visual de Fortnite')
  .addStringOption(option =>
    option.setName('username')
      .setDescription('Nombre del jugador de Fortnite')
      .setRequired(true)
  ),

  new SlashCommandBuilder()
    .setName('registrarglobal')
    .setDescription('Registra todos los comandos globalmente (para admins)'),
  new SlashCommandBuilder()
    .setName('cambiarentradas')
    .setDescription('seleccióna el nombre del canal de entradas en esta guild')
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Selecciona el canal de entradas y salidas')
        .setRequired(true)
    ),

  // 👇👇 COMANDOS DE TWITCH 👇👇

  new SlashCommandBuilder()
    .setName('selectchannel')
    .setDescription('Selecciona el canal donde se anunciarán los directos de Twitch')
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal de texto donde se enviarán los anuncios de Twitch')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('selecttwitchchannel')
    .setDescription('Agrega un canal de Twitch a monitorear en este servidor')
    .addStringOption(option =>
      option.setName('login')
        .setDescription('Nombre del canal de Twitch (login, sin https)')
        .setRequired(true)
    ),
];
  //------------------------------------------------------------------------


  //----------------------------------------------------------------------------------------------
  //JUEGOS
  // Emojis y variables de la carrera
const EMOJIS = ["🐒", "🐟", "🐢", "🐇", "🐌", "🐘", "🐕", "🐅", "🐿️", "🦉"];
let carreraActiva = false;
let participantes = [];
let posiciones = [];
const longitudPista = 20;

// Registrar comandos
client.once("ready", async () => {
  console.log(`✅ Bot iniciado como ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("🔄 Registrando comandos...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Comandos registrados correctamente.");
  } catch (error) {
    console.error("❌ Error al registrar los comandos:", error);
  }
});

// Generar pista
const generarPista = (longitud, posiciones, emojis) => {
  return posiciones
    .map((pos, i) => {
      const espacios = " ".repeat(pos);
      const restantes = Math.max(0, longitud - pos - 1); // Evita valores negativos
      const linea = `${espacios}${emojis[i]}${" ".repeat(restantes)}|`;
      return linea;
    })
    .join("\n");
};

// Avance aleatorio
const avanzar = () => Math.floor(Math.random() * 3);

// Manejar comandos
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "carrera") {
    if (carreraActiva) {
      await interaction.reply("⚠️ Ya hay una carrera en curso.");
      return;
    }

    carreraActiva = true;
    participantes = [];
    posiciones = [];

    const mensajeInicial = await interaction.reply({
      content: "🏁 ¡Carrera iniciada! Escribe `/participar` para unirte. La carrera comienza en 15 segundos.",
      fetchReply: true,
    });

    setTimeout(async () => {
      if (participantes.length < 2) {
        carreraActiva = false;
        await interaction.channel.send("❌ No hay suficientes jugadores (mínimo 2) para iniciar la carrera.");
        return;
      }

      const emojis = participantes.map((p) => p.emoji);
      let mensajeCarrera = `🎮 Participantes: ${emojis.join(", ")}\n🏁 ¡La carrera comienza ahora!`;
      let ganadores = [];

      // Actualizar mensaje de la carrera
      while (ganadores.length === 0) {
        // Mover a los jugadores
        for (let i = 0; i < posiciones.length; i++) {
          posiciones[i] += avanzar();
          if (posiciones[i] >= longitudPista && !ganadores.includes(participantes[i])) {
            ganadores.push(participantes[i]);
          }
        }

        // Generar pista y actualizar mensaje
        const pista = generarPista(longitudPista, posiciones, participantes.map((p) => p.emoji));
        mensajeCarrera = `🎮 Participantes: ${emojis.join(", ")}\n\`\`\`\n${pista}\n\`\`\``;
        await mensajeInicial.edit(mensajeCarrera);

        await new Promise((resolve) => setTimeout(resolve, 2000)); // Pausa entre actualizaciones
      }

      // Anunciar al ganador
      const mensajeGanador = ganadores
        .map((g) => `<@${g.id}> (${g.emoji})`)
        .join(", ");
      await interaction.channel.send(
        `🎉 ¡Felicidades ${mensajeGanador}! Has ganado, eres un verdadero ninja 🥷`
      );
      carreraActiva = false;
    }, 15000);
  }

  if (commandName === "participar") {
    if (!carreraActiva) {
      await interaction.reply("⚠️ No hay una carrera activa. Usa `/carrera` para iniciar una.");
      return;
    }

    const userId = interaction.user.id;
    if (participantes.some((p) => p.id === userId)) {
      await interaction.reply("⚠️ Ya estás inscrito en esta carrera.");
      return;
    }

    if (participantes.length >= EMOJIS.length) {
      await interaction.reply("⚠️ No hay más espacios disponibles en esta carrera.");
      return;
    }

    const emoji = EMOJIS[participantes.length];
    participantes.push({ id: userId, emoji });
    posiciones.push(0);

    await interaction.reply(`🎉 Te has unido a la carrera con el emoji ${emoji}`);
  }

  
});

//juegos de combate 
// Variables de combate
let combateActivo = false;
let jugadores = [];
let turnoActual = 0;
let combateTimeout; // Temporizador de inactividad

// Registrar los comandos
client.once("ready", async () => {
  console.log(`✅ Bot iniciado como ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("🔄 Registrando comandos...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log("✅ Comandos registrados correctamente.");
  } catch (error) {
    console.error("❌ Error al registrar los comandos:", error);
  }
});

// Generar estadísticas iniciales
const generarEstadisticas = () => ({
  vida: 100,
  energia: 100,
  defensa: 0,
});

// Mensajes personalizados
const frasesGanador = [
  "¡Eres un verdadero ninja, {nombre}! 🥷",
  "El camino del ninja te pertenece, {nombre}. 🌟",
  "La victoria es tuya, {nombre}. ¡Sigue adelante como un verdadero guerrero! 💪",
  "¡{nombre}, tu astucia y fuerza son incomparables! 🎉",
  "¡Impresionante, {nombre}! Eres un verdadero maestro de las artes ninja. 🥋",
  "Con esta victoria, {nombre}, te has ganado el respeto de todos. 🔥",
  "¡Así se juega un combate ninja, {nombre}! 🌟",
  "La victoria de hoy se quedará en la historia, {nombre}. 🏆",
  "¡Hoy se celebra la victoria de {nombre}! 🎯",
  "Así es como se hace, {nombre}. ¡Eres un campeón! 💪",
  "El clan SaK está orgulloso de tu victoria, {nombre}. 🐉",
  "SaK te saluda, {nombre}, como un verdadero shinobi. 🌠",
  "La victoria es el reflejo de tu entrenamiento, {nombre}. 🏯",
  "SaK sabe que la victoria es solo el principio para {nombre}. 🔥",
  "¡Tu valentía ha llevado a SaK a la cima, {nombre}! 🏅",
  "Tu nombre será recordado en SaK por esta victoria, {nombre}. 🌟",
  "SaK te celebra, {nombre}. La victoria es el reflejo de tu esfuerzo. 🌌",
  "SaK está de fiesta gracias a tu victoria, {nombre}. 🎉",
  "El espíritu de SaK vive en tu victoria, {nombre}. 🥋",
];

const frasesPerdedor = [
  "Así es el camino ninja de SaK, {nombre}. Aprende de esta derrota. 🌀",
  "Solo los fuertes perseveran, {nombre}. ¡Levántate y sigue luchando! 🌠",
  "Cada derrota es una lección, {nombre}. El espíritu ninja nunca se rinde. 🔥",
  "No te preocupes, {nombre}, los grandes ninjas también han caído alguna vez. 💪",
  "{nombre}, la derrota es solo un peldaño más en tu camino ninja. 🏯",
  "La derrota solo te hace más fuerte, {nombre}. No olvides nunca tu entrenamiento. 🏋️‍♂️",
  "El camino ninja no es fácil, {nombre}, pero los más grandes siempre se levantan. 🌱",
  "Hoy es el primer día de tu nueva victoria, {nombre}. 🌅",
  "Levántate, {nombre}, el camino ninja te está esperando. 🌠",
  "A veces la derrota nos enseña más que la victoria, {nombre}. 🔥",
  "El clan SaK respalda a sus ninjas, {nombre}. Sigue luchando. 🐉",
  "Tu derrota hoy, {nombre}, será el motor de tu victoria mañana. 🌞",
  "Los grandes ninjas caen, pero nunca se rinden, {nombre}. ¡Levántate! 💪",
  "SaK cree en ti, {nombre}. Cada caída es una oportunidad para levantarse. 🏯",
  "¡Aún puedes! El clan SaK siempre estará contigo, {nombre}. 🌺",
  "Cada derrota te acerca a ser más fuerte, {nombre}. Sigue adelante. 💥",
  "Los ninjas de SaK no temen a la derrota, {nombre}. ¡El camino sigue! 🌌",
  "SaK no abandona a sus guerreros, {nombre}. Vamos, ¡es hora de regresar más fuerte! 🔥",
  "{nombre}, SaK cree en tu determinación. ¡La próxima victoria será tuya! 🌠",
  "Levántate, {nombre}. El espíritu ninja de SaK te acompaña en cada paso. 🥷",
];

// Acción de combate
const realizarAccion = async (accion, jugador, oponente, interaction) => {
	let resultado = "";
  
	switch (accion) {
	  case "curar":
		if (jugador.energia >= 10) {
		  const curacion = Math.floor(Math.random() * 30) + 1;
		  jugador.vida = Math.min(jugador.vida + curacion, 100);
		  jugador.energia -= 10;
		  resultado = `🩹 ${jugador.nombre} se cura ${curacion} puntos de vida. Ahora tiene ${jugador.vida} de vida y ${jugador.energia} de energía.`;
		} else {
		  resultado = `❌ ${jugador.nombre} no tiene suficiente energía para curarse. Energía restante: ${jugador.energia}.`;
		}
		break;
  
	  case "ataque":
		let dañoBase = Math.floor(Math.random() * 17) + 8;
		if (jugador.vida <= 25) {
		  dañoBase += Math.floor(Math.random() * 10) + 5; // Incremento de daño si la vida está baja
		}
		const dañoAtaque = dañoBase - oponente.defensa;
		oponente.vida = Math.max(oponente.vida - Math.max(dañoAtaque, 0), 0);
		oponente.defensa = 0; // La defensa se anula después de un turno
		resultado = `⚔️ ${jugador.nombre} ataca e inflige ${Math.max(dañoAtaque, 0)} de daño. ${oponente.nombre} tiene ${oponente.vida} de vida restante. Energía restante: ${jugador.energia}.`;
		break;
  
	  case "ataque_especial":
		if (jugador.energia >= 60) {
		  let dañoEspecialBase = Math.floor(Math.random() * 56) + 1;
		  if (jugador.vida <= 25) {
			dañoEspecialBase += Math.floor(Math.random() * 20) + 10; // Incremento de daño si la vida está baja
		  }
		  const dañoEspecial = dañoEspecialBase - oponente.defensa;
		  oponente.vida = Math.max(oponente.vida - Math.max(dañoEspecial, 0), 0);
		  oponente.defensa = 0;
		  jugador.energia -= 60;
		  resultado = `💥 ${jugador.nombre} usa un ataque especial e inflige ${Math.max(dañoEspecial, 0)} de daño. ${oponente.nombre} tiene ${oponente.vida} de vida restante. Energía restante: ${jugador.energia}.`;
		} else {
		  resultado = `❌ ${jugador.nombre} no tiene suficiente energía para un ataque especial. Energía restante: ${jugador.energia}.`;
		}
		break;
  
	  case "defender":
		if (jugador.energia >= 10) {
		  const defensa = Math.floor(Math.random() * 40) + 1;
		  jugador.defensa = defensa;
		  jugador.energia -= 10;
		  resultado = `🛡️ ${jugador.nombre} se prepara para defender y podrá absorber ${defensa} de daño en el próximo turno. Energía restante: ${jugador.energia}.`;
		} else {
		  resultado = `❌ ${jugador.nombre} no tiene suficiente energía para defender. Energía restante: ${jugador.energia}.`;
		}
		break;
  
	  case "recargar":
		const recarga = jugador.vida > 50
		  ? Math.floor(Math.random() * 30) + 1
		  : Math.floor(Math.random() * 200) + 1;
		jugador.energia = Math.min(jugador.energia + recarga, 100);
		resultado = `🔋 ${jugador.nombre} recarga ${recarga} puntos de energía. Ahora tiene ${jugador.energia} de energía.`;
		break;
  
	  default:
		resultado = "❌ Acción no válida.";
	}
  
	// Reiniciar temporizador después de cada acción
	clearTimeout(combateTimeout);
	combateTimeout = setTimeout(() => {
	  interaction.channel.send("⏳ ¡El combate ha sido cancelado por inactividad! ⚠️");
	  combateActivo = false;
	  jugadores = [];
	}, 60000); // 60 segundos de inactividad
  
	await interaction.update({
	  content: resultado,
	  components: [],
	});
  
	turnoActual = (turnoActual + 1) % 2;
  
	// Comprobar si el combate ha terminado
	if (jugadores[0].vida <= 0 || jugadores[1].vida <= 0) {
	  const ganador = jugadores[0].vida > 0 ? jugadores[0] : jugadores[1];
	  const perdedor = jugadores[0].vida <= 0 ? jugadores[0] : jugadores[1];
  
	  const mensajeGanador = frasesGanador[Math.floor(Math.random() * frasesGanador.length)].replace("{nombre}", ganador.nombre);
	  const mensajePerdedor = frasesPerdedor[Math.floor(Math.random() * frasesPerdedor.length)].replace("{nombre}", perdedor.nombre);
  
	  await interaction.channel.send(`🎉 ¡${ganador.nombre} ha ganado el combate! ${mensajeGanador}`);
	  await interaction.channel.send(`😞 ${perdedor.nombre}, mejor suerte la próxima vez. ${mensajePerdedor}`);
  
	  combateActivo = false;
	  jugadores = [];
	} else {
	  await interaction.channel.send(`🎮 Es el turno de ${jugadores[turnoActual].nombre}.`);
	  mostrarOpciones(interaction.channel, jugadores[turnoActual]);
	}
  };
  

// Mostrar opciones para el jugador
const mostrarOpciones = (channel, jugador) => {
  const botones = [
    new ButtonBuilder()
      .setCustomId("ataque")
      .setLabel("Atacar")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("defender")
      .setLabel("Defender")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("curar")
      .setLabel("Curarse")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ataque_especial")
      .setLabel("Ataque Especial")
      .setStyle(ButtonStyle.Danger),
  ];

  channel.send({
    content: `${jugador.nombre}, es tu turno. Elige una acción:`,
    components: [new ActionRowBuilder().addComponents(botones)],
  });
};

// Manejar comandos
client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    const { commandName } = interaction;

    if (commandName === "combate") {
      if (combateActivo) {
        await interaction.reply("⚠️ Ya hay un combate en curso. Espera a que termine.");
        return;
      }

      const oponente = interaction.options.getUser("oponente");
      if (oponente.bot || oponente.id === interaction.user.id) {
        await interaction.reply("⚠️ No puedes retar a este usuario.");
        return;
      }

      combateActivo = true;
      jugadores = [
        { id: interaction.user.id, nombre: interaction.user.username, ...generarEstadisticas() },
        { id: oponente.id, nombre: oponente.username, ...generarEstadisticas() },
      ];
      turnoActual = 0;

      await interaction.reply(`⚔️ ${interaction.user.username} ha retado a ${oponente.username} a un combate. Usa \`/si\` para aceptar o \`/no\` para rechazar.`);

      // Configurar el temporizador de inactividad
      combateTimeout = setTimeout(() => {
        interaction.followUp("⏳ ¡El combate ha sido cancelado por inactividad! ⚠️");
        combateActivo = false;
        jugadores = [];
      }, 60000); // 60 segundos
    }

    if (commandName === "si") {
      if (!combateActivo || jugadores[1].id !== interaction.user.id) {
        await interaction.reply("⚠️ No tienes un desafío pendiente para aceptar.");
        return;
      }

      clearTimeout(combateTimeout); // Cancelar temporizador si se acepta el combate

      await interaction.reply(`🎮 El combate ha comenzado entre ${jugadores[0].nombre} y ${jugadores[1].nombre}. Turno de ${jugadores[0].nombre}.`);
      mostrarOpciones(interaction.channel, jugadores[0]);
    }

    if (commandName === "no") {
      if (!combateActivo || jugadores[1].id !== interaction.user.id) {
        await interaction.reply("⚠️ No tienes un desafío pendiente para rechazar.");
        return;
      }

      clearTimeout(combateTimeout); // Cancelar temporizador si se rechaza el combate

      await interaction.reply("😞 ¡Desgracia sobre ti, sobre tu casa y sobre tu vaca! El desafío ha sido rechazado.");
      combateActivo = false;
      jugadores = [];
    }
  }

  if (interaction.isButton()) {
    const jugador = jugadores[turnoActual];
    if (interaction.user.id !== jugador.id) {
      await interaction.reply({ content: "⚠️ No es tu turno.", ephemeral: true });
      return;
    }

    const oponente = jugadores[(turnoActual + 1) % 2];
    realizarAccion(interaction.customId, jugador, oponente, interaction);
  }
});


// Iniciar el bot
  //----------------------------------------------------------------------------------
// Registrar los comandos en Discord
client.once("ready", async () => {
	console.log(`✅ Bot iniciado como ${client.user.tag}`);
  
	const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  
	try {
	  console.log("🔄 Registrando comandos...");
	  await rest.put(
		Routes.applicationCommands(process.env.CLIENT_ID),
		{ body: commands }
	  );
	  console.log("✅ Comandos registrados correctamente.");
	} catch (error) {
	  console.error("❌ Error al registrar los comandos:", error);
	}
  });
  
client.once('ready', async () => {
    try {
        console.log('Registrando comandos slash...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Comandos slash registrados correctamente en Discord!');
    } catch (error) {
        console.error('Error al registrar los comandos slash:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;


	//-/////////////////////////////////////////////////////

	if (interaction.commandName === 'setgiveawaychannel') {

    const canal = interaction.options.getChannel('canal');

    if (!canal) {
        return interaction.reply({
            content: "❌ No se pudo obtener el canal.",
            ephemeral: true
        });
    }

    console.log("Guild ID:", interaction.guildId);
    console.log("Canal seleccionado:", canal.id);

    setChannel(interaction.guildId, canal.id);

    return interaction.reply({
        content: `✅ Canal configurado: ${canal}`,
        ephemeral: true
    });
}
/////////////////////////////////////////////////////////////////////////
    if (interaction.commandName === 'genshinarmas') {
        await handleGenshinArmas(interaction);
    }

	if (interaction.commandName === 'playerfortnite') {
    await handlePlayerFortnite(interaction);
}


if (interaction.commandName === 'playermarvel') {
   await handlePlayerMarvel(interaction);
}
    if (interaction.commandName === 'genshinartefactos') {
        await handleGenshinArtefactos(interaction);
    }

	if (interaction.commandName === 'cambiarentradas') {
        // ... (lógica para verificar permisos) ...
    
        const nuevoCanal = interaction.options.getChannel('canal');
        canalSeleccionadoId = nuevoCanal.id; // Actualizamos el ID del canal seleccionado
        interaction.reply({
          content: `El canal de bienvenida/despedida ahora será ${nuevoCanal.name}`,
          ephemeral: true
        });
    }
});


  //-----------------------------------------------------------

  const mistralClient = new Mistral({ apiKey: process.env.AGENT_API_KEY });

// Manejar interacciones de slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "mistral") {
    const consulta = interaction.options.getString("consulta");

    // Responder inicialmente para evitar tiempo de espera
    await interaction.deferReply();

    try {
      // Llamar a la API de Mistral
      const chatResponse = await mistralClient.chat.complete({
        model: 'mistral-large-latest',
        messages: [{ role: 'user', content: consulta }],
      });

      const respuesta = chatResponse.choices[0].message.content;

      // Log para ver la respuesta de Mistral
      console.log("📬 Respuesta de Mistral:", respuesta);

      // Responder al usuario con el resultado de Mistral
      await interaction.editReply({ content: respuesta });
    } catch (error) {
      console.error("❌ Error procesando la consulta:", error.message);
      console.error("Detalles del error:", JSON.stringify(error, null, 2));

      // Mejorar el mensaje de error con detalles
      await interaction.editReply({
        content: `Hubo un error al procesar tu consulta. Detalles: \`${error.message}\`. Por favor, intenta más tarde.`,
      });
    }
  }
});

  //-------------------------------------------------------------------------
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
  client.once('ready', async () => { 
	console.log(`¡El bot está listo como ${client.user.tag}!`);
	client.user.setActivity('test', { type: 'PLAYING' });
  
	try {
	  console.log('Comenzando a registrar comandos globalmente...');
	  await rest.put(
		Routes.applicationCommands(process.env.CLIENT_ID),
		{ body: commands }
	  );
	  console.log('¡Comandos registrados globalmente!');
	} catch (error) {
	  console.error('Error al registrar comandos:', error);
	}
  });
  
  client.on('interactionCreate', async (interaction) => {
	if (!interaction.isCommand()) return;
   
  
	if (interaction.commandName === 'anime') {
	  // ... your existing '/anime' command logic ...
	} else if (interaction.commandName === 'buscaranime') {
	  const animeName = interaction.options.getString('nombre-anime');
	  animeflv.searchAnime(animeName).then((result) => {
		// Create an EmbedBuilder instance
		const anime= new EmbedBuilder();
	  
		
		// Check if the result data array contains entries
		if (result.data && result.data.length > 0) {
		  // Set embed title using the first result's title
		  anime.setTitle(result.data[0].title); 
  
		  // Check if there's only one result, then use it directly
		  if (result.data.length === 1) {
			  const imageUrl = result.data[0].cover;
			  const jpgIndex = imageUrl.lastIndexOf('.jpg'); // Encuentra la última ocurrencia de ".jpg" en la URL
			  const trimmedImageUrl = imageUrl.substring(0, jpgIndex);
			  console.log('trimmedImageUrl:', trimmedImageUrl);
			// Set description, image, URL, and rating from the single result
			anime
			  .setDescription(result.data[0].synopsis)
			  .setImage(imageUrl)
			  .setURL(result.data[0].url)
			  .setColor('#008000')
			  .setFooter({ text: `Rating: ${result.data[0].rating}` });
  
			// Send the embed to the interaction
			interaction.reply({ embeds: [anime.toJSON()], result});
			console.log(result)
		  } else {
			// If there are multiple results, create multiple fields
			const fields = [];
			for (const animeInfo of result.data) {
			  const field = {
				name: animeInfo.title,
				value: `[Sinopsis](${animeInfo.synopsis}) | [Link](${animeInfo.url})`,
				inline: true // Set to true for multiple fields in one row
			  };
			  fields.push(field);
			}
  
			// Set embed fields and send
			anime.addFields(...fields); // Spread the fields array
			interaction.reply({ embeds: [anime.toJSON()] });
		  } 
		} else {
		   // Handle the case where the API result might be empty or malformed
		   interaction.reply({ content: 'Error fetching buscaranime information. Please try again later!', ephemeral: true }); 
		}
  
	  }).catch((error) => {
		console.error('Error fetching anime info:', error);  
		interaction.reply({ content: 'Error fetching buscaranime information. Try again later!', ephemeral: true }); 
	  });
	}
  });
//--------------------------------------------------------------------------------------------------

  
  // Manejar comandos de barra
  client.on('interactionCreate', async (interaction) => {
	if (!interaction.isCommand()) return;
  
	const { commandName } = interaction;
  
	if (commandName === 'codigos_honkai') {
	  try {
		const response = await fetch('https://hoyo-codes.seria.moe/codes?game=hkrpg');
		const data = await response.json();
		const codes = data.codes.map(code => `**${code.code}** - ${code.rewards}`).join('\n') || 'No hay códigos disponibles en este momento.';
  
		const embed = new EmbedBuilder()
		  .setColor('#722ED1') 
		  .setTitle('Códigos de Honkai: Star Rail')
		  .setDescription(codes)
		  .setThumbnail('https://i.blogs.es/ec9d1f/honkai-star-rail/1366_2000.jpeg')
		  .setImage('https://64.media.tumblr.com/56c5739856e2e9fc0ebc589a09cefc44/7cc140a4ab9024c1-f2/s400x600/2fba33a0f6640207d2575fdaa5e4cc28860a74c5.gif')
		  .setFooter({ text: '¡Canjea tus códigos en el juego!' });
  
		await interaction.reply({ embeds: [embed] });
	  } catch (error) {
		console.error('Error al obtener los códigos:', error);
		await interaction.reply({ content: 'Hubo un error al intentar obtener los códigos. Inténtalo más tarde.', ephemeral: true });
	  }
	}
  
	if (commandName === 'codigos_honkai3d') {
	  try {
		const response = await fetch('https://hoyo-codes.seria.moe/codes?game=honkai3rd');
		const data = await response.json();
		const codes = data.codes.map(code => `**${code.code}** - ${code.rewards}`).join('\n') || 'No hay códigos disponibles en este momento.';
  
		const embed = new EmbedBuilder()
		  .setColor('#FF4500')
		  .setTitle('Códigos de Honkai Impact 3rd')
		  .setDescription(codes)
		  .setThumbnail('https://static.wikia.nocookie.net/honkaiimpact3_gamepedia_en/images/4/4e/1024x1024bb_01.jpg/revision/latest/scale-to-width-down/250?cb=20211218132057')
		  .setImage('https://i.pinimg.com/originals/c2/d1/d4/c2d1d40b282c96a37c8dc3855a87b8dc.gif')
		  .setFooter({ text: '¡Canjea tus códigos en el juego!' });
  
		await interaction.reply({ embeds: [embed] });
	  } catch (error) {
		console.error('Error al obtener los códigos:', error);
		await interaction.reply({ content: 'Hubo un error al intentar obtener los códigos. Inténtalo más tarde.', ephemeral: true });
	  }
	}
  
	if (commandName === 'codigosgenshin') {
	  try {
		const response = await fetch('https://hoyo-codes.seria.moe/codes?game=genshin');
		const data = await response.json();
		const codes = data.codes.map(code => `**${code.code}** - ${code.rewards}`).join('\n') || 'No hay códigos disponibles en este momento.';
  
		const embed = new EmbedBuilder()
		  .setColor('#FFFFFF')
		  .setTitle('Códigos de Genshin Impact')
		  .setDescription(codes)
		  .setThumbnail('https://www.korosenai.es/wp-content/uploads/2020/12/xinyan-genshin-impact.jpg')
		  .setImage('https://media.tenor.com/o7ZpfQX3G8gAAAAM/genshin-impact-paimon.gif')
		  .setFooter({ text: '¡Canjea tus códigos en el juego!' });
  
		await interaction.reply({ embeds: [embed] });
	  } catch (error) {
		console.error('Error al obtener los códigos:', error);
		await interaction.reply({ content: 'Hubo un error al intentar obtener los códigos. Inténtalo más tarde.', ephemeral: true });
	  }
	}
  
	if (commandName === 'codigoszzz') {
	  try {
		const response = await fetch('https://hoyo-codes.seria.moe/codes?game=nap');
		const data = await response.json();
		const codes = data.codes.map(code => `**${code.code}** - ${code.rewards}`).join('\n') || 'No hay códigos disponibles en este momento.';
  
		const embed = new EmbedBuilder()
		  .setColor('#FF69B4')
		  .setTitle('Códigos de Zenless Zone Zero (Nap)')
		  .setDescription(codes)
		  .setThumbnail('https://fastcdn.hoyoverse.com/content-v2/nap/102183/9d1acec79f0755124cdc057d5729f879_223269942321786228.png')
		  .setImage('https://media.tenor.com/ytJhdaHvHCQAAAAM/ellen-joe-zenless-zone-zero.gif')
		  .setFooter({ text: '¡Canjea tus códigos en el juego!' });
  
		await interaction.reply({ embeds: [embed] });
	  } catch (error) {
		console.error('Error al obtener los códigos:', error);
		await interaction.reply({ content: 'Hubo un error al intentar obtener los códigos. Inténtalo más tarde.', ephemeral: true });
	  }
	}
  });
  //-------------------------------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  console.log('\n==============================');
  console.log('[INTERACTION]', interaction.commandName);

  console.log('[DEBUG] Comandos disponibles:',
    [...client.commands.keys()]
  );

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.log('[ERROR] Comando NO encontrado en Map');
    return;
  }

  console.log('[DEBUG] Ejecutando comando:', command.name);

  await command.execute(interaction);
});
//------------------------------------------------------------------------------------------------------------------

client.once('ready', async () => {
	// Define el comando slash
	const pingCommand = new SlashCommandBuilder()
	  .setName('ping')
	  .setDescription('Envía un mensaje de ping');
  
	// Registra el comando en Discord
	const command = await client.application.commands.create(pingCommand);
	console.log(`Comando '/ping' registrado: ${command.name}`);
  });
  
  

//----------------------------------------------------------------------------------------------------------
client.commands = new Collection();
client.commandArray = [];
client.buttons = new Collection();


const fns = {put:dbPut,get:dbGet,del:dbDel}
const functionFolders = fs.readdirSync('./functions');
for(const folder of functionFolders) {
    const functionFiles = fs.readdirSync('./functions/'+folder).filter(file=>file.endsWith('.js'));
    for(const file of functionFiles) require('./functions/'+folder+'/'+file)(client,fns);
}

//--------------------------------------------------------


  
  // Registrar comandos cuando el bot esté listo
  client.once('ready', async () => {
	console.log('Bot listo');
	await registerCommands();
  });
  
  // Manejar el comando de barra
  client.on('interactionCreate', async (interaction) => {
	if (!interaction.isCommand()) return;
  
	const { commandName } = interaction;
	if (commandName === 'navidad') {
	  try {
		const channel = interaction.channel; // El canal en el que se ejecuta el comando
  
		// Embed para Feliz Navidad
		const embed1 = new EmbedBuilder()
		  .setColor('#FFFFFF') // Blanco
		  .setTitle('¡Feliz Navidad! 🎄🎁')
		  .setDescription('¡Disfruta de este video y celebra con nosotros!')
		  .setURL('https://youtu.be/qD-W4m-R2U8?si=jdXH7moYpb50m7-t')
		  .setImage('https://img.youtube.com/vi/qD-W4m-R2U8/0.jpg') // Miniatura
		  .setFooter({ text: 'Yey, es diciembre' });
  
		// Embed para Año Nuevo
		const embed2 = new EmbedBuilder()
		  .setColor('#00FF00') // Verde
		  .setTitle('¡Y próspero Año Nuevo! 🎉🥂')
		  .setDescription('¡Mira este video y celebremos juntos!')
		  .setURL('https://www.youtube.com/watch?v=WYDhQuJqiuo')
		  .setImage('https://img.youtube.com/vi/WYDhQuJqiuo/0.jpg') // Miniatura
		  .setFooter({ text: 'Yey, es diciembre' });
  
		// Enviar los embeds al canal
		await channel.send({ content: '@everyone', embeds: [embed1, embed2] });
		console.log('Embeds enviados con éxito');
		await interaction.reply({ content: '¡Embeds de Navidad y Año Nuevo enviados!', ephemeral: true });
	  } catch (error) {
		console.error('Error al enviar los embeds:', error);
		await interaction.reply({ content: 'Hubo un error al enviar los embeds.', ephemeral: true });
	  }
	}
  });
//----------------------------------
function getRandomColor() {
	// Generar un color hexadecimal aleatorio
	return `#${Math.floor(Math.random() * 16777215).toString(16)}`;
}
//----------------------------------------------------

//-------------------------


async function fetchWithRetry(url, retries = 3, delay = 1000) {
	try {
		const response = await fetch(url);
		return await response.json();
	} catch (error) {
		if (retries > 0) {
			console.error(`Error al obtener datos de la API (${retries} intentos restantes):`, error);
			await new Promise(resolve => setTimeout(resolve, delay)); // Esperamos antes de reintentar
			return fetchWithRetry(url, retries - 1, delay * 2); // Reintentamos con delay mayor
		} else {
			throw error; // Si se agotaron los reintentos, propagamos el error 
		}
	}
}

client.on('messageCreate', async (message) => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();


	//--------------------------------qiqi de prueba
	if (command === 'genshin') {
		const searchTerm = args.join(' ');

		if (!searchTerm) {
			message.channel.send('Por favor, ingresa un nombre de personaje después del comando "genshin".');
			return;
		}

		const characterURL = `https://genshin.jmp.blue/characters/${searchTerm}`;
		let qiqiData; // Declaración de la variable dentro de la función

		try {
			qiqiData = await fetchWithRetry(characterURL);
			if (!qiqiData || !qiqiData.name || !qiqiData.rarity) {
				message.channel.send(`No se encontró información válida para el personaje "${searchTerm}".`);
				return;
			}
			const randomcolorembed = {
				color: '#' + (Math.random() * 0xFFFFFF << 0).toString(16),

			};


			const colores = {
				rojo: '#FF0000',
				verde: '#00FF00',
				azul: '#0000FF',
				amarillo: '#FFFF00',
				magenta: '#FF00FF',
				cian: '#00FFFF',
				blanco: '#FFFFFF',
				negro: '#000000'
			};

			function obtenerRandomColor(colores) {
				const randomIndex = Math.floor(Math.random() * colores.length);
				return colores[randomIndex];
			}
			const qiqiembed = new EmbedBuilder()
				.setColor("Random")
				.setTitle(`Información de ${qiqiData.name}`)
				.setFooter({
					text: `Cumpleaños  ${qiqiData.birthday}`
				})

				.setImage(`https://genshin.jmp.blue/characters/${searchTerm}/gacha-splash`)
				.addFields(
					{ name: 'Rareza en estrellas:', value: qiqiData.rarity.toString(), inline: true }, // Campo de rareza
					{ name: 'Arma:', value: qiqiData.weapon === 'Sword' ? `[⚔️](https://cdn.discordapp.com/emojis/753321036209834472/753321036209834472.png)` : qiqiData.weapon === 'Bow' ? `[🏹](https://cdn.discordapp.com/emojis/753321036209834472/753321036209834472.png)` : qiqiData.weapon === 'Catalyst' ? `[📖](https://cdn.discordapp.com/emojis/753321036209834472/753321036209834472.png)` : qiqiData.weapon === 'Claymore' ? `[🗡️](https://cdn.discordapp.com/emojis/753321036209834472/753321036209834472.png)` : `[🔪](https://cdn.discordapp.com/emojis/753321036209834472/753321036209834472.png)`, inline: false },
					{ name: 'Fecha de lanzamiento', value: qiqiData.release, inline: true },
					{ name: 'Nacion:', value: qiqiData.nation, inline: true }, // Campo de habilidad elemental
					{ name: 'Afiliación:', value: qiqiData.affiliation, inline: true },
					{ name: 'Sexo:', value: qiqiData.gender === 'Female' ? 'Femenino' : qiqiData.gender === 'Male' ? 'Masculino' : 'Otro' },
					{
						name: 'Vision:',
						value:
						qiqiData.vision === 'Geo' ? `[🪨](https://example.com/geo_icon.png) Geo` : 
						qiqiData.vision === 'Hydro' ? `[🌊](https://example.com/hydro_icon.png) Hydro` :
							qiqiData.vision === 'Pyro' ? `[🔥](https://example.com/pyro_icon.png) Pyro` :
								qiqiData.vision === 'Dendro' ? `[🌱](https://example.com/dendro_icon.png) Dendro` :
									qiqiData.vision === 'Cryo' ? `[❄️](https://example.com/cryo_icon.png) Cryo` :
										qiqiData.vision === 'Electro' ? `[⚡](https://example.com/electro_icon.png) Electro` :
											qiqiData.vision === 'Anemo' ? `[🍃](https://example.com/anemo_icon.png) Airesito` : 'Visión no disponible', // Default case
						inline: true
					}





					// Campo de habilidad definitiva
				); // Conversión a string





			message.channel.send({ embeds: [qiqiembed] }); // Asegúrate de embeder usando embeds: []

		} catch (error) {
			console.error(`Error al obtener datos del personaje: ${qiqiData.name}`, error);
			message.channel.send('¡Hubo un error al buscar información del personaje! Intenta nuevamente más tarde.');
		}
	}


	//-----------------------------------------------------------------------------------------



});
//---------------------------------regis
//-----------comandos registro
//--------------------------------------------------------------------------------------------------
async function registerCommands() {
	const commands = [
	  new SlashCommandBuilder()
		.setName('codigos_wuwa')
		.setDescription('Obtén los últimos códigos de Wuthering Waves'),
	];
  
	const guilds = client.guilds.cache;
  
	// Registrar comandos solo en servidores donde el bot tenga permisos adecuados
	for (const [guildId, guild] of guilds) {
	  try {
		const member = await guild.members.fetch(client.user.id);
		const hasPermission = member.permissions.has(PermissionsBitField.Flags.ManageGuild);
  
		if (hasPermission) {
		  await guild.commands.set(commands);
		  console.log(`Comando registrado en el servidor: ${guild.name}`);
		} else {
		  console.log(`No tiene permisos suficientes en el servidor: ${guild.name}`);
		}
	  } catch (error) {
		console.error(`Error al registrar el comando en ${guild.name}:`, error);
	  }
	}
  }
// Manejar comandos de barra
client.on('interactionCreate', async (interaction) => {
	if (!interaction.isCommand()) return;
  
	const { commandName } = interaction;
  
	if (commandName === 'codigos_wuwa') {
	  try {
		// Llamada a la API
		const response = await fetch('https://api.resonance.rest/codes');
		if (!response.ok) {
		  return interaction.reply({ content: 'No se pudieron obtener los códigos en este momento. Inténtalo más tarde.', ephemeral: true });
		}
		const data = await response.json();
  
		// Formatear los códigos
		const codes = data.codes.map(code => `**${code.name}** - ${code.reward}`).join('\n') || 'No hay códigos disponibles en este momento.';
  
		// Crear el embed
		const embed = new EmbedBuilder()
		  .setColor('#003366') // Azul oscuro
		  .setTitle('Códigos de Wuthering Waves')
		  .setDescription(codes)
		  .setThumbnail('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQkmsLi-PweF4K3vppsBMmbrQ2zFikTpYHdNg&s')
		  .setImage('https://media.tenor.com/bUdiwYNKvz8AAAAM/wuwa-wuthering-waves.gif')
		  .setFooter({ text: '¡Canjea tus códigos en el juego para obtener recompensas!' });
  
		await interaction.reply({ embeds: [embed] });
	  } catch (error) {
		console.error('Error al obtener los códigos:', error);
		await interaction.reply({ content: 'Hubo un error al intentar obtener los códigos. Inténtalo más tarde.', ephemeral: true });
	  }
	}
  });


//--------------------------------------------------------------------------------------------------------------------------
/*
async function fetchWithRetry(url, retries = 3, delay = 1000) {
	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Error al obtener respuesta (${response.status}): ${response.statusText}`);
		}

		const data = await response.json();
		return data;
	} catch (error) {
		if (retries > 0) {
			console.error(`Error al obtener datos de la API (${retries} intentos restantes):`, error);
			await new Promise(resolve => setTimeout(resolve, delay)); // Esperamos antes de reintentar
			return fetchWithRetry(url, retries - 1, delay * 2); // Reintentamos con delay mayor
		} else {
			throw error; // Si se agotaron los reintentos, propagamos el error
		}
	}
}

client.once('ready', () => {
	console.log(`¡Bot de Genshin activado como ${client.user.tag}!`);
});

//---------------------------------------------------------------------------/*
/*async function fetchWithRetry(url, retries = 3, delay = 1000) {
	try {
		const response = await fetch(url);
		return await response.json();
	} catch (error) {
		if (retries > 0) {
			console.error(`Error al obtener datos de la API (${retries} intentos restantes):`, error);
			await new Promise(resolve => setTimeout(resolve, delay)); // Esperamos antes de reintentar
			return fetchWithRetry(url, retries - 1, delay * 2); // Reintentamos con delay mayor
		} else {
			throw error; // Si se agotaron los reintentos, propagamos el error 
		}
	}
}*/

/* client.on('messageCreate', async (message) => {
   if (!message.content.startsWith(prefix) || message.author.bot) return;

   const args = message.content.slice(prefix.length).trim().split(/ +/);
   const command = args.shift().toLowerCase();

   if (command === 'genshin') {
	   const searchTerm = args.join(' ');
	   if (!searchTerm) {
		   message.channel.send('Por favor, ingresa un nombre de personaje después del comando "genshin".');
		   return;
	   }

	   const characterURL = `https://genshin.jmp.blue/characters/${searchTerm}`;
	   try {
		   const characterData = await fetchWithRetry(characterURL);
		   if (!characterData || !characterData.name || !characterData.rarity) {
			   message.channel.send(`No se encontró información válida para el personaje "${searchTerm}".`);
			   return;
		   }

		   const embedColor = getRandomColor();
		   const embed = new Discord.MessageEmbed()
			   .setColor(embedColor)
			   .setTitle(`Información de ${characterData.name}`)
			   .addField('Rareza:', characterData.rarity, true);

		   message.channel.send({ embeds: [embed] });
	   } catch (error) {
		   console.error('Error al obtener datos del personaje:', error);
		   message.channel.send('¡Hubo un error al buscar información del personaje! Intenta nuevamente más tarde.');
	   }
   }
});
*/
//--------------------------------------------------------
/*async function fetchWithRetry(url, retries = 3, delay = 1000) {
	try {
		const response = await fetch(url);
		return await response.json();
	} catch (error) {
		if (retries > 0) {
			console.error(`Error al obtener datos de la API (${retries} intentos restantes):`, error);
			await new Promise(resolve => setTimeout(resolve, delay)); // Esperamos antes de reintentar
			return fetchWithRetry(url, retries - 1, delay * 2); // Reintentamos con delay mayor
		} else {
			throw error; // Si se agotaron los reintentos, propagamos el error 
		}
	}
}
	
client.on('messageCreate', async (message) => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;
	
	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();
	
	if (command === 'genshin') {
		const searchTerm = args.join(' ');
		if (!searchTerm) {
			message.channel.send('Por favor, ingresa un nombre de personaje después del comando "genshin".');
			return;
		}
	
		const characterURL = `https://genshin.jmp.blue/characters/${searchTerm}`;
		try {
			const qiqiData = await fetchWithRetry(characterURL);
			if (!qiqiData || !qiqiData.name || !qiqiData.rarity) {
				message.channel.send(`No se encontró información válida para el personaje "${searchTerm}".`);
				return;
			}
	
			message.channel.send(`**Información de ${qiqiData.name}**\n\n* Rareza: ${qiqiData.rarity}`);
		} catch (error) {
			console.error('Error al obtener datos del personaje:', error);
			message.channel.send('¡Hubo un error al buscar información del personaje! Intenta nuevamente más tarde.');
		}
	}
});
	

//---------------------------------------------------------------------
	
*/


//-------------------------------------------------------------------------------------------------------------
//In this example we want to get some information about a character

//OR with async/await function


// Define tu prefijo si lo usas



/* client.on('ready', () => {
	 console.log(`¡Bot de Genshin activado como ${client.user.tag}!`);
 });
 
 client.on('messageCreate', async (message) => { // Actualizado para v14
	 if (!message.content.startsWith(prefix) || message.author.bot) return;*/

//-----------------------------


//--------------
/* const args = message.content.slice(prefix.length).trim().split(/ +/);
 const command = args.shift().toLowerCase();*/
//------------------------------------
/* async function fetchWithRetry(url, retries = 3, delay = 1000) {
   try {
	   const response = await fetch(url);
	   return await response.json();
   } catch (error) {
	   if (retries > 0) {
		   console.error(`Error al obtener datos de la API (${retries} intentos restantes):`, error);
		   await new Promise(resolve => setTimeout(resolve, delay)); // Esperamos antes de reintentar
		   return fetchWithRetry(url, retries - 1, delay * 2); // Reintentamos con delay mayor
	   } else {
		   throw error; // Si se agotaron los reintentos, propagamos el error 
	   }
   }
}

// ... dentro de tu evento messageCreate:
if (command === 'qiqi') {
   try {
	   const qiqi = await fetchWithRetry('https://api.genshin.dev/characters/qiqi');
	   message.channel.send(`Name: ${qiqi.name} \n Rarity: ${qiqi.rarity}`);
   } catch (error) {
	   console.error('Error al obtener datos de Qiqi:', error);
	   message.channel.send('¡Hubo un error al buscar información de Qiqi! Intenta nuevamente más tarde.');
   }
}*/

//----------------------------------------------
/*  if (command === 'genshin') {
	  const searchTerm = args.join(' '); // Une argumentos si usas espacios
 
	  try {
		  const genshinData = await genshinAPI.getCharacter(searchTerm); 
 
		  if (genshinData) {
			  message.channel.send(`**Información de ${genshinData.name}**\n\n* Descripción: ${genshinData.description}\n* Elemento: ${genshinData.element}\n* Visión: ${genshinData.vision}`);
		  } else {
			  message.channel.send(`No se encontró información sobre "${searchTerm}".`);
		  }
	  } catch (error) {
		  console.error('Error al obtener la información de Genshin:', error);
		  message.channel.send('Ocurrió un error al obtener la información. ¡Intenta más tarde!');
	  }
  }
});*/




//-------------------------------------------------------------------------------------------------------------




// ... (resto de tu código de Discord.js)

// Crear la cola y definir la tarea (como en el ejemplo anterior)




//----------------

//----------------------------------------------------------------
// Función principal asíncrona

// Función principal asíncrona

/* async function main() {
	// Crear cliente de Redis
	const redisClient = createClient({
	  socket: {
		host: 'localhost',
		port: 6379
	  }
	});
  
	// Manejar errores de conexión
	redisClient.on('error', (err) => console.log('Redis Client Error', err));
  
	// Conectar al cliente Redis
	await redisClient.connect();  // Mueve el await dentro de la función async
  
	// Crear una cola usando BullMQ
	const queue = new Queue('my-queue', {
	  connection: { host: 'localhost', port: 6379 }
	});
  
	// Definir un worker para procesar tareas
	const worker = new Worker('my-queue', async (job) => {
	  console.log('Processing job:', job.data);
	  // Aquí va el código de tu tarea
	  const channel = client.channels.cache.get('970127433879654491');
	  await channel.send('Tarea completada');
	}, { connection: { host: 'localhost', port: 6379 } });
  
	// Agregar una tarea a la cola
	await queue.add('my-task', { data: 'Some data' });
  
	console.log('Tarea agregada a la cola');
  }
  
  // Llamar a la función main
  main().catch((err) => console.error('Error en la ejecución:', err));

*/
  //----------------------------------------------------------------------------------------------------

// ==============================
//  CONFIGURACIÓN TWITCH
// ==============================

const CONFIG_FILE = './twitch-config.json';

// twitchConfig: {
//   [guildId]: {
//     announcementChannelId: string,
//     twitchChannels: Array<{ login: string, lastStreamId?: string } | string>
//   }
// }
let twitchConfig = {};

try {
	const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
	twitchConfig = JSON.parse(raw);
	console.log('Configuración Twitch cargada:', twitchConfig);
} catch {
	console.log('No se encontró twitch-config.json, se creará uno nuevo al guardar.');
	twitchConfig = {};
}

// Guarda la configuración actual en disco
function saveConfig() {
	fs.writeFileSync(CONFIG_FILE, JSON.stringify(twitchConfig, null, 2));
	console.log('Configuración Twitch guardada en twitch-config.json');
}

// ==============================
//  LOG DE ERRORES DE TWITCH
// ==============================

function logTwitchError(contexto, error) {
	console.error(`\n[TWITCH] Error en: ${contexto}`);

	if (error.isAxiosError) {
		const status = error.response?.status;
		const statusText = error.response?.statusText;
		const url = error.config?.url;
		const method = error.config?.method?.toUpperCase();

		console.error(`[TWITCH] Petición: ${method || 'GET'} ${url || 'URL desconocida'}`);

		if (status) {
			console.error(`[TWITCH] HTTP Status: ${status} ${statusText || ''}`);
		} else {
			console.error('[TWITCH] No se recibió respuesta HTTP (¿timeout, DNS, red?)');
		}

		if (error.response?.data) {
			console.error('[TWITCH] Respuesta de Twitch (data):');
			console.error(JSON.stringify(error.response.data, null, 2));
		}

		if (error.code) {
			console.error(`[TWITCH] Código de error de Axios/Node: ${error.code}`);
		}
	} else {
		console.error('[TWITCH] Error no Axios:', error);
	}

	console.error('[TWITCH] Fin del reporte de error.\n');
}

// ==============================
//  COMPROBAR ESTADO DE CANALES TWITCH Y ANUNCIAR
//  - Anuncia SOLO UNA VEZ por stream (usa stream.id y lastStreamId)
//  - twitchChannels puede tener strings (formato viejo) u objetos { login, lastStreamId }
// ==============================

async function checkLiveStatus() {
	console.log('\n[TWITCH] ===== Iniciando ciclo de comprobación =====');

	let configChanged = false;

	try {
		// Si no hay servidores configurados, no llamamos a la API de Twitch
		const guildIds = Object.keys(twitchConfig || {});
		if (guildIds.length === 0) {
			console.log('[TWITCH] No hay servidores configurados. Usa /selectchannel y /selecttwitchchannel.');
			setTimeout(checkLiveStatus, 300000); // 5 minutos
			return;
		}

		// Obtenemos UN solo token de Twitch por ciclo
		const token = await getTwitchAccessToken();
		const headers = {
			Authorization: `Bearer ${token}`,
			'Client-ID': process.env.TWITCH_CLIENT_ID,
		};

		// Recorremos cada servidor que tenga configuración
		for (const [guildId, cfg] of Object.entries(twitchConfig)) {
			const { announcementChannelId, twitchChannels } = cfg;

			const loginsString = (twitchChannels && twitchChannels.length > 0)
				? twitchChannels
					.map((ch) => (typeof ch === 'string' ? ch : ch.login))
					.join(', ')
				: 'ninguno';

			console.log(`[TWITCH] Servidor ${guildId} → canal anuncios: ${announcementChannelId}, canales Twitch: ${loginsString}`);

			if (!announcementChannelId || !twitchChannels || twitchChannels.length === 0) {
				continue;
			}

			const guild = client.guilds.cache.get(guildId);
			if (!guild) {
				console.log(`[TWITCH] No estoy en el servidor con ID ${guildId}, lo omito.`);
				continue;
			}

			const announcementChannel = guild.channels.cache.get(announcementChannelId);
			if (!announcementChannel) {
				console.log(`[TWITCH] El canal de anuncios ${announcementChannelId} no existe en el servidor ${guildId}, lo omito.`);
				continue;
			}

			// Opcional: pequeña protección de permisos para evitar Missing Access
			const me = guild.members.me;
			if (!me || !announcementChannel.viewable || !announcementChannel.permissionsFor(me)?.has(PermissionsBitField.Flags.SendMessages)) {
				console.log(`[TWITCH] No tengo acceso o permisos para enviar mensajes en el canal ${announcementChannelId} en el servidor ${guildId}.`);
				continue;
			}

			// Revisamos cada canal de Twitch configurado para ese servidor
			for (let i = 0; i < twitchChannels.length; i++) {
				const chanInfo = twitchChannels[i];

				// Puede ser string (viejo) u objeto (nuevo)
				const login = typeof chanInfo === 'string' ? chanInfo : chanInfo.login;
				if (!login) continue;

				console.log(`[TWITCH] Revisando canal Twitch "${login}" para servidor ${guildId}...`);

				try {
					// 1) Info del usuario de Twitch
					const twitchUserResponse = await axios.get(
						'https://api.twitch.tv/helix/users',
						{ params: { login }, headers }
					);

					const userData = twitchUserResponse.data.data[0];

					if (!userData) {
						console.warn(`[TWITCH] No se encontró el usuario Twitch: ${login}`);
						continue;
					}

					// 2) Estado del stream (en vivo o no)
					const twitchChannelResponse = await axios.get(
						'https://api.twitch.tv/helix/streams',
						{ params: { user_id: userData.id }, headers }
					);

					const data = twitchChannelResponse.data.data; // array 0 o 1 elemento

					// No está en vivo
					if (!data || data.length === 0) {
						console.log(`[TWITCH] ${login} NO está en directo en el servidor ${guildId}.`);

						// Si ya teníamos objeto con lastStreamId, lo limpiamos
						if (typeof chanInfo !== 'string' && chanInfo.lastStreamId) {
							chanInfo.lastStreamId = null;
							configChanged = true;
						}
						continue;
					}

					// Sí está en vivo
					const stream = data[0];
					const currentStreamId = stream.id;

					// Aseguramos que sea objeto (normaliza formato viejo string → objeto)
					let channelObj;
					if (typeof chanInfo === 'string') {
						channelObj = { login, lastStreamId: null };
						twitchChannels[i] = channelObj;
						cfg.twitchChannels = twitchChannels;
						configChanged = true;
					} else {
						channelObj = chanInfo;
					}

					// Si el streamId es el mismo que ya anunciamos → NO repetimos anuncio
					if (channelObj.lastStreamId === currentStreamId) {
						console.log(`[TWITCH] ${login} sigue en directo con el mismo streamId, ya se anunció antes en este servidor.`);
						continue;
					}

					console.log(`[TWITCH] ${login} está EN DIRECTO en el servidor ${guildId}, enviando anuncio (nuevo streamId: ${currentStreamId})...`);

					const streamURL = `https://www.twitch.tv/${login}`;
					const viewerToString = stream.viewer_count.toString();
					const screenImg = stream.thumbnail_url
						.replace('{width}', '1920')
						.replace('{height}', '1080');

					const embed = new EmbedBuilder()
						.setColor('#772ce8')
						.setTitle(stream.title || 'Stream en directo')
						.setURL(streamURL)
						.setAuthor({
							name: `${stream.user_name} está en vivo`,
							iconURL: userData.profile_image_url || null,
							url: streamURL,
						})
						.addFields(
							{
								name: 'Categoria',
								value: stream.game_name || 'Sin categoría',
								inline: true,
							},
							{
								name: 'Espectadores',
								value: viewerToString,
								inline: true,
							},
						)
						.setImage(screenImg)
						.setTimestamp()
						.setFooter({ text: 'Ven a verlo' });

					await announcementChannel.send({
						embeds: [embed],
						content: '¡La transmisión está encendida, te esperamos!\n\n@everyone',
					});

					// Guardamos este streamId para NO volver a anunciarlo en este servidor
					channelObj.lastStreamId = currentStreamId;
					configChanged = true;

					console.log(`[TWITCH] Anuncio enviado para ${stream.user_name} en el servidor ${guildId}.`);
				} catch (err) {
					logTwitchError(`checkLiveStatus → guild ${guildId} / canal Twitch ${login}`, err);
				}
			}
		}
	} catch (error) {
		logTwitchError('checkLiveStatus (bucle general)', error);
	} finally {
		if (configChanged) {
			saveConfig();
		}
		console.log('[TWITCH] ===== Fin de ciclo. Programando siguiente comprobación =====\n');
		setTimeout(checkLiveStatus, 300000); // 5 minutos
	}
}

// ==============================
//  TOKEN DE TWITCH
// ==============================

async function getTwitchAccessToken() {
	try {
		const twitchAuthResponse = await axios.post(
			`https://id.twitch.tv/oauth2/token` +
			`?client_id=${process.env.TWITCH_CLIENT_ID}` +
			`&client_secret=${process.env.TWITCH_CLIENT_SECRET}` +
			`&grant_type=client_credentials`
		);

		return twitchAuthResponse.data.access_token;
	} catch (error) {
		logTwitchError('getTwitchAccessToken (obteniendo token OAuth)', error);
		console.error('[TWITCH] Revisa TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET en las variables de entorno.');
		throw error;
	}
}

// ==============================
//  BOT LISTO → INICIAR MONITOREO
// ==============================

client.on('ready', async () => {
	console.log(`${client.user.tag} ha sido lanzado, listo para ver los canales de Twitch.`);
	checkLiveStatus(); // Arranca el ciclo
	client.user.setPresence({
		activities: [{ name: 'Espiándolos desde las sombras' }],
		status: 'online',
	});
});

// ==============================
//  SLASH COMMANDS RELACIONADOS
// ==============================

client.on('interactionCreate', async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const { commandName } = interaction;

	// /channel → tu comando original
	if (commandName === 'channel') {
		await interaction.reply(CHANNEL_LINK_ADVERT);
		return;
	}

	// /selectchannel → define canal de anuncios en este servidor
	if (commandName === 'selectchannel') {
		const guildId = interaction.guildId;
		const channel = interaction.options.getChannel('canal');

		if (!channel || !channel.isTextBased()) {
			return interaction.reply({
				content: 'El canal debe ser un canal de texto.',
				ephemeral: true,
			});
		}

		if (!twitchConfig[guildId]) {
			twitchConfig[guildId] = {
				announcementChannelId: null,
				twitchChannels: [],
			};
		}

		twitchConfig[guildId].announcementChannelId = channel.id;
		saveConfig();

		return interaction.reply({
			content: `Este será el canal de anuncios de Twitch para este servidor: ${channel}`,
			ephemeral: true,
		});
	}

	// /selecttwitchchannel → agrega canal de Twitch para este servidor
	if (commandName === 'selecttwitchchannel') {
		const guildId = interaction.guildId;
		let login = interaction.options.getString('login');

		if (!login) {
			return interaction.reply({
				content: 'Debes indicar el nombre (login) del canal de Twitch.',
				ephemeral: true,
			});
		}

		login = login.toLowerCase().trim();

		if (!twitchConfig[guildId]) {
			twitchConfig[guildId] = {
				announcementChannelId: null,
				twitchChannels: [],
			};
		}

		const cfg = twitchConfig[guildId];

		// Evitar duplicados (funciona con strings viejos u objetos nuevos)
		const alreadyExists = cfg.twitchChannels.some((ch) =>
			(typeof ch === 'string' ? ch === login : ch.login === login)
		);

		if (alreadyExists) {
			return interaction.reply({
				content: `El canal de Twitch **${login}** ya estaba registrado para este servidor.`,
				ephemeral: true,
			});
		}

		// Nuevo formato: objeto
		cfg.twitchChannels.push({
			login,
			lastStreamId: null,
		});

		saveConfig();

		return interaction.reply({
			content: `Canal de Twitch **${login}** agregado para este servidor.`,
			ephemeral: true,
		});
	}
});

//---------------------------------------------------------------------


//--------------------------------------------------
ffmpeg_options = {
	'options': '-vn',
	"before_options": "-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5"
}
// ==============================================================================

//===aqui el codigo de entradas=====================================================================================
// ==============================
//  ENTRADAS / SALIDAS (WELCOME / BYE)
//  - Bienvenida: GIFs por fecha (navidad / enero) + 6 default al azar
//  - Despedida: GIFs por fecha (navidad / enero) + 6 default al azar
//  - Usa twitchConfig[guildId].welcomeChannelId para recordar el canal
// ==============================

// ==============================
//  GIFs DE BIENVENIDA
// ==============================

// 6 GIFS DEFAULT DE BIENVENIDA (sin fecha especial)
const WELCOME_DEFAULT_GIFS = [
	'https://cdn.discordapp.com/attachments/1135778462393700363/1174983874292486216/media_391849520865956371_1700205038.gif?ex=65699401&is=65571f01&hm=55556e98c863076472a2794717684affe804a8a133eab33ab2d94e87a6bfdee1&', // original
	'https://media.discordapp.net/attachments/569009136734306304/1448423759412330537/Digen_video_1765401439255-ezgif.com-video-to-gif-converter.gif?ex=693b353e&is=6939e3be&hm=db18234159d9b8eda85eb9a3afdc810feed797f7c2e8e56fe97002e9be28c8b9&=&width=1000&height=550',
	'https://cdn.discordapp.com/attachments/569009136734306304/1448426263843835954/Digen_video_1765402026880-ezgif.com-video-to-gif-converter.gif?ex=693b3793&is=6939e613&hm=53587085dc8e4ab5804816b89771a2930787e07c9bcf93ed995ef9169ee14793&',
	'https://media.discordapp.net/attachments/569009136734306304/1448432718378438769/Digen_video_1765403590831-ezgif.com-video-to-gif-converter.gif?ex=693b3d96&is=6939ec16&hm=0c7e1554bcf27d516da9df09bf2e97f728c8a923f8850c199bc2fab500587b80&=&width=1000&height=550',
	'https://media.discordapp.net/attachments/569009136734306304/1448435501232160829/Digen_video_1765404285594-ezgif.com-video-to-gif-converter.gif?ex=693b402e&is=6939eeae&hm=60d4774c2aa0d00326f950777b6360b2a6fc52a3dccb0b75d8bbcae6a8b4e15e&=&width=1000&height=550',
	'https://media.discordapp.net/attachments/569009136734306304/1448437570705817630/Digen_video_1765404718605-ezgif.com-video-to-gif-converter.gif?ex=693b421b&is=6939f09b&hm=d0ec048f9860ec8d581090173ced83eb698ffa8bb643ae515b5abf25e482ea62&=&width=1000&height=550'
];

// GIF navideño (25 nov – 15 ene)
const WELCOME_HOLIDAY_GIF =
	'https://media.discordapp.net/attachments/569009136734306304/1448365914968952832/Digen_video_1765387539489_1.gif?ex=693aff5f&is=6939addf&hm=efe333d9af0dd7440b358cb89aa48d4d3a9c605c6aecba2d3694f6faf9917ca4&=&width=500&height=275';

// GIF especial de enero (16 – 30 ene)
const WELCOME_JAN_GIF =
	'https://cdn.discordapp.com/attachments/569009136734306304/1448364132632887368/Digen_video_1765387136388.gif?ex=693afdb6&is=6939ac36&hm=b00c95d8bbc4518f92cbc1b55891d7f551f06e4193259478968c7751cdfbedfd&';


// ==============================
//  GIFs DE DESPEDIDA
// ==============================

// 6 GIFS DEFAULT DE DESPEDIDA (sin fecha especial)
const FAREWELL_DEFAULT_GIFS = [
	'https://cdn.discordapp.com/attachments/1135778462393700363/1176079397128781844/media_392958085897304853_1700469437.gif?ex=656d904a&is=655b1b4a&hm=a1da6767223541b93d7ccb41f3bef2fab682c543498eac906b5ed16d4d5e9b62&', // default original
	'https://media.discordapp.net/attachments/569009136734306304/1448409798424002601/Digen_video_1765398162642.gif?ex=693b283e&is=6939d6be&hm=5612e6998489853c6de7f5abde6f041d5e2e0eef67ffde66432cc0c59d402896&=&width=500&height=275',
	'https://cdn.discordapp.com/attachments/569009136734306304/1448411222839136499/Digen_video_1765398495455_1.gif?ex=693b2991&is=6939d811&hm=953c3b221c35002302dfca3e6aa3f16e08d98d93c5efe44965539262f600159e&',
	'https://cdn.discordapp.com/attachments/569009136734306304/1448412538390970488/Digen_video_1765398812208.gif?ex=693b2acb&is=6939d94b&hm=259bd00137b75e6805d2a26aff045e900f9a825a2aef2e489001b42ff2f64808&',
	'https://media.discordapp.net/attachments/569009136734306304/1448419883879763978/Digen_video_1765400513279.gif?ex=693b31a2&is=6939e022&hm=628e7eb624527f349c340a5aa35b42d7bb24263e13fb6f6654194dddc6bf18e0&=&width=500&height=281',
	'https://media.discordapp.net/attachments/569009136734306304/1448420042369929369/Digen_video_1765400541647.gif?ex=693b31c8&is=6939e048&hm=0fbedff5914ad2dd8b9ee23828da620e40415407187f9c99ea92448091f3c46d&=&width=500&height=275'
];

// GIF navideño de despedida (25 nov – 15 ene)
const FAREWELL_HOLIDAY_GIF =
	'https://media.discordapp.net/attachments/569009136734306304/1448372469969846332/Digen_video_1765389212672.gif?ex=693b057a&is=6939b3fa&hm=aed68b86f087fe1dccf1a287f8735fc147be382615838a6c04e5d3ad5451a2c8&=&width=500&height=275';

// GIF especial de enero para despedida (16 – 30 ene, por ejemplo)
const FAREWELL_JAN_GIF =
	'https://cdn.discordapp.com/attachments/569009136734306304/1448408496474423356/Digen_video_1765397629250.gif?ex=693b2707&is=6939d587&hm=0fb89f8bf4938893120f083b48927e3a3311b8236cbba025de473002f3d5765e&';


// ==============================
//  HELPERS
// ==============================

// newUsers guardará una Collection por servidor para agrupar mensajes
const newUsers = {};

// Función para elegir un elemento al azar de un array
function getRandomFromArray(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

const RIR = new EmbedBuilder()
	.setFooter({
		text: "Bienvenido este es el mejor servidor del mundo disfruta tu estadia",
	})
	.setColor('Random')
	// imagen base, luego se reemplaza según fecha
	.setImage(WELCOME_DEFAULT_GIFS[0]);

const RIR1 = new EmbedBuilder()
	.setDescription("Ha sido un placer tenerte con nosotros, lamento tu partida")
	.setFooter({
		text: "Adiós, te extrañaremos",
	})
	.setColor('#fc9787')
	// imagen base, luego se reemplaza según fecha
	.setImage(FAREWELL_DEFAULT_GIFS[0]);

// ==============================
//  FUNCIONES PARA ELEGIR GIF SEGÚN LA FECHA
// ==============================

function getWelcomeGifForDate(date = new Date()) {
	const month = date.getMonth() + 1; // 1–12
	const day = date.getDate();        // 1–31

	// 25 nov – 15 ene → GIF navideño
	if ((month === 11 && day >= 25) || month === 12 || (month === 1 && day <= 15)) {
		return WELCOME_HOLIDAY_GIF;
	}

	// 16 – 30 ene → GIF especial de enero
	if (month === 1 && day >= 16 && day <= 30) {
		return WELCOME_JAN_GIF;
	}

	// Resto del año → uno de los 6 GIF default al azar
	return getRandomFromArray(WELCOME_DEFAULT_GIFS);
}

function getFarewellGifForDate(date = new Date()) {
	const month = date.getMonth() + 1;
	const day = date.getDate();

	// 25 nov – 15 ene → GIF navideño de despedida
	if ((month === 11 && day >= 25) || month === 12 || (month === 1 && day <= 15)) {
		return FAREWELL_HOLIDAY_GIF;
	}

	// 16 – 30 ene → GIF especial de enero para despedida
	if (month === 1 && day >= 16 && day <= 30) {
		return FAREWELL_JAN_GIF;
	}

	// Resto del año → uno de los 6 GIF default al azar
	return getRandomFromArray(FAREWELL_DEFAULT_GIFS);
}


// ==============================
//  CANAL DE ENTRADAS POR SERVIDOR
//  - Usa twitchConfig[guildId].welcomeChannelId
//  - Solo crea canal si tiene permiso, si no, pide /cambiarentradas
// ==============================

async function getOrCreateWelcomeChannel(guild) {
	const guildId = guild.id;

	// Aseguramos estructura base en twitchConfig para este servidor
	if (!twitchConfig[guildId]) {
		twitchConfig[guildId] = {
			announcementChannelId: null,
			twitchChannels: [],
			welcomeChannelId: null,
		};
	}

	let welcomeChannelId = twitchConfig[guildId].welcomeChannelId;
	let canal = null;

	// 1) Si ya hay un canal guardado por /cambiarentradas, usamos ese
	if (welcomeChannelId) {
		canal = guild.channels.cache.get(welcomeChannelId);
		if (canal && canal.isTextBased()) {
			return canal;
		} else {
			console.log(`[ENTRADAS] El canal guardado (${welcomeChannelId}) ya no existe o no es de texto en el servidor ${guildId}.`);
		}
	}

	// 2) Si no hay ID guardado, intentamos encontrar uno existente con nombres típicos
	canal = guild.channels.cache.find(
		(ch) =>
			ch.isTextBased() &&
			['entradas', 'welcome', 'bienvenidos', 'bienvenida', 'entradas-salidas'].includes(ch.name)
	);

	if (canal) {
		console.log(`[ENTRADAS] Se usará el canal existente #${canal.name} en servidor ${guildId}.`);
		twitchConfig[guildId].welcomeChannelId = canal.id;
		saveConfig();
		return canal;
	}

	// 3) Si no hay ninguno y el bot NO tiene permisos para crear canales, no intentamos crear
	const me = guild.members.me;
	if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
		console.log(`[ENTRADAS] No tengo permiso para crear canales en el servidor ${guildId}. Usa /cambiarentradas para seleccionar uno.`);
		return null;
	}

	// 4) Intentamos crear un canal nuevo #entradas SOLO si tenemos permisos
	try {
		canal = await guild.channels.create({
			name: 'entradas',
			type: Discord.ChannelType.GuildText,
			reason: 'Canal de entradas/autocreado por el bot',
		});
		console.log(`[ENTRADAS] Canal #${canal.name} creado en servidor ${guildId}.`);

		twitchConfig[guildId].welcomeChannelId = canal.id;
		saveConfig();

		return canal;
	} catch (error) {
		console.error('[ENTRADAS] No se pudo crear el canal de entradas:', error);
		return null;
	}
}

// ==============================
//  FUNCIÓN DE ENVÍO SEGURO (PROTEGE DE Missing Access)
// ==============================

async function safeSendEntradaSalida(canal, payload, guildId) {
	try {
		await canal.send(payload);
	} catch (err) {
		console.error('[ENTRADAS] Error al enviar mensaje:', err);

		// 50001 = Missing Access, 50013 = Missing Permissions
		if ((err.code === 50001 || err.code === 50013) && twitchConfig[guildId]) {
			console.log(`[ENTRADAS] Perdí acceso al canal ${canal.id} en ${guildId}, reseteando welcomeChannelId.`);
			twitchConfig[guildId].welcomeChannelId = null;
			saveConfig();
		}
	}
}


// ==============================
//  EVENTOS DE ENTRADA / SALIDA
// ==============================

client.on("guildMemberAdd", async (member) => {
	const guild = member.guild;
	const guildId = guild.id;

	if (!newUsers[guildId]) newUsers[guildId] = new Discord.Collection();
	newUsers[guildId].set(member.id, member.user);

	const canal = await getOrCreateWelcomeChannel(guild);
	if (!canal) {
		console.log(`[ENTRADAS] No hay canal disponible para bienvenida en el servidor ${guildId}.`);
		return;
	}

	if (newUsers[guildId].size > 0) {
		const userlist = newUsers[guildId].map((u) => u.toString()).join(" ");

		// Clonamos el embed base y cambiamos la imagen según la fecha
		const embedBienvenida = EmbedBuilder.from(RIR);
		embedBienvenida.setImage(getWelcomeGifForDate());

		await safeSendEntradaSalida(canal, "Bienvenido mortal, disfruta tu estadía OwO !\n" + userlist, guildId);
		await safeSendEntradaSalida(canal, { embeds: [embedBienvenida] }, guildId);

		newUsers[guildId].clear();
	}
});

client.on("guildMemberRemove", async (member) => {
	const guild = member.guild;
	const guildId = guild.id;

	if (!newUsers[guildId]) newUsers[guildId] = new Discord.Collection();
	newUsers[guildId].set(member.id, member.user);

	const canal = await getOrCreateWelcomeChannel(guild);
	if (!canal) {
		console.log(`[ENTRADAS] No hay canal disponible para despedida en el servidor ${guildId}.`);
		return;
	}

	if (newUsers[guildId].size > 0) {
		const userlist = newUsers[guildId].map((u) => u.toString()).join(" ");

		// Clonamos el embed base y cambiamos la imagen según la fecha
		const embedDespedida = EmbedBuilder.from(RIR1);
		embedDespedida.setImage(getFarewellGifForDate());

		await safeSendEntradaSalida(canal, "¡Adiós!\n" + userlist, guildId);
		await safeSendEntradaSalida(canal, { embeds: [embedDespedida] }, guildId);

		newUsers[guildId].clear();
	}
});



//=============aqui el final de entradas ============================
	//-------------------------------------------------------------------------------------------------------------------
	
	

//-----------------------------------------------------------------------------------------------------------



client.login(process.env.TOKEN);
const prefix = "*";

client.on("messageCreate", (message) => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).split(/ + /);

	const command = args.shift().toLowerCase();

	const messageArray = message.content.split(" ");
	const argument = messageArray.slice(1);
	client.waifu = require("./waifu.json")
	client.husbando = require("./husbando.json")
	const cmd = messageArray[0];
	const Target = message.mentions.users.first() || message.author;
	let user = message.mentions.users.first();
	let member = Target.username || message.author.username;
	const mention = message.mentions.users.first();
	//----------------------------------------------------------------------------------------------------------------------



	//--------------------------------------------------------------------------------------
	const exampleEmbed = new EmbedBuilder()
		.setDescription(message.author.username + ` Beso a  ${Target.username}`)
		.setFooter({
			text: "se gustan"
		})
		.setColor('#ff0080')
		.setImage('https://acegif.com/wp-content/uploads/anime-kissin-5.gif')



	if (message.content.includes(prefix + "test")) {

		message.channel.send({ embeds: [exampleEmbed] });
	}

	//-------------------


	const avatarp = new EmbedBuilder()

		.setTitle(`avatar de :${Target.tag}`)
		.setImage(Target.displayAvatarURL({ size: 2048, dynamic: true }))
		.setColor('#513564')
		.setFooter({
			text: "que guapo"
		})
		.setTimestamp()

	//------------------------------------------------------------
	if (message.content.includes(prefix + "avatar")) {



		message.channel.send({ embeds: [avatarp] });

	}

	//--------------------------------------------------------------------------



	//----------------------------------------------------------------------------
	const meme1 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://pbs.twimg.com/media/FYx930NWQAAUun_?format=jpg&name=large')


	const meme2 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/6ada50f383134c7a569f66f722474bb942064398/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f77303132466153347150537469673d3d2d35312e313636663664373331636330653564353332333236313433383535382e6a7067')


	const meme3 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://pbs.twimg.com/media/FLRVaubVUAIzmSA.jpg')


	const meme4 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://pbs.twimg.com/media/FYx9fHbX0AAQCL_.png')


	const meme5 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/8ec7e3c944efff9684d40a838657a2a844ec7669/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f454433686a4d72464572374b4e673d3d2d35312e313636663664373166353332333333303436353239383932353536352e6a7067?s=fit&w=720&h=720')


	const meme6 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://pbs.twimg.com/media/FZXs7NTWQAAbJoh.jpg')


	const meme7 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/420c5332d19de5dc36443cd441517e4b304372a0/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f55785132546f546f7153785f75773d3d2d38382e313462663865616531636166326566653232393530383035393132322e6a7067')


	const meme8 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('http://images3.memedroid.com/images/UPLOADED215/5f467ce353820.jpeg')


	const meme9 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('http://pm1.narvii.com/6415/5b13b0c35b55e0a8739817cf765fba7877ba9692_00.jpg')


	const meme10 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/9b3960cb870eff773a8668c0700a03c6315043a2/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f632d4e6c43696d6e654d7a374e413d3d2d3531372e313661386334633931316531633735353638393636323831333233382e6a7067?s=fit&w=720&h=720')


	const meme11 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('http://images3.memedroid.com/images/UPLOADED248/6091ac3c158ca.jpeg')


	const meme12 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://preview.redd.it/5kqtgbc5dak81.jpg?width=539&format=pjpg&auto=webp&s=e22dc84a71141ae33824b458b0c8b1efcbf7d2bc')


	const meme13 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.pinimg.com/564x/7c/f0/02/7cf002e1aff12c29fb152a24bfc25568.jpg')


	const meme14 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/9cb81c5e3a41900999cf37b45d55bea108aa4a3e/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f396274575677517539506d4c52413d3d2d3934303136353638342e313632643838373238663331316564373130323137323437333732342e6a7067?s=fit&w=720&h=720');


	const meme15 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/42a0914a865d03fc328eb73fe025a3fedc2d907b/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f3745366a6f4f33724870594a6d413d3d2d3134302e313632633238306263323439626635663830353139313535363430342e6a7067?s=fit&w=720&h=720')


	const meme16 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/8b5f1bd8e7900a8fb9d2f8d9bcd3f744957c97e6/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f5565677148635234396b72527a773d3d2d3138312e313633346264613865326366396566613635343030313736383638302e6a7067?s=fit&w=720&h=720')


	const meme17 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.pinimg.com/236x/d4/d0/88/d4d088e8218cb988a16c089bb257b7d0.jpg')


	const meme18 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.pinimg.com/736x/08/60/af/0860afb3a01924a8f7e301c4092c4640.jpg')


	const meme19 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/5c31fa35bf00889522720bda608fefd5695ed99f/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f37467a41306737737978594734413d3d2d3134322e313632653132363531363531383736373132353631343735343437342e6a7067?s=fit&w=720&h=720');


	const meme20 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://www.unionguanajuato.mx/wp-content/uploads/2020/12/memes_graciosos_del_frio.jpeg')


	const meme21 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://media1.tenor.com/images/2e157785600a39a48a1ae100578ecba3/tenor.gif?itemid=4762746')


	const meme22 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('http://images7.memedroid.com/images/UPLOADED980/6353b613ce521.jpeg')


	const meme23 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhv8aNqF1w0fsfe8gjn3jStx92iY4eSJXf7Vuqz_GOLNfde8SZta4mm8dA9zf505nT0wEwKSurbQ22GAjnkBo3wrtDym1jU9pqIZOlBYEIC-69Ky2yDawP4SByTfZMY_hrAcvALIgUWRC64dh0z8nB0vcRRAFaM8wuCe9cUid9oleV1wkqWsE-y3eRrlA/s828/1B40908D-AB29-4922-8FEC-9D2DB9CC8E80.jpeg')


	const meme24 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://www.heraldousa.com/u/fotografias/m/2021/12/21/f1280x720-23046_154721_5050.jpg');


	const meme25 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://memesmasgraciosos.com/wp-content/uploads/2021/12/meme-que-pase-lo-que-tenga-que-pasar.jpg')


	const meme26 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://memesmasgraciosos.com/wp-content/uploads/2021/11/meme-escuelas-publicas-vs-privadas.jpg')


	const meme27 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://depor.com/resizer/MnJvuwNOu44mHHs3JL62-v5Cuoc=/980x0/smart/filters:format(jpeg):quality(75)/cloudfront-us-east-1.images.arcpublishing.com/elcomercio/AJXFZ3EF65CJFJWD4AGMOUJUBI.jpg')


	const meme28 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.pinimg.com/564x/de/01/fd/de01fd6d03c4e9b622e2b33f88cf929e.jpg');


	const meme29 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://www.deanime.info/wp-content/uploads/2018/11/meme-canas-dragon-ball-super.png')


	const meme30 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://pbs.twimg.com/media/DcQ9KtQWsAA9m_H.jpg')


	const meme31 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmaduls7MoKAVGejBtTvaLdtGN-2mmxdUz8Q&usqp=CAU')


	const meme32 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://images7.memedroid.com/images/UPLOADED185/559e9083272bd.jpeg');


	const meme33 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS2P-Js7CUPBj5pRKi6cHhxzcgRzmDHs9EKxA&usqp=CAU')


	const meme34 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.chzbgr.com/full/8266328832/h678FC6C3/gohan-es-un-loquillo');


	const meme35 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.pinimg.com/236x/cb/21/7f/cb217f4159d4e2e6bb73305e780f8dfc.jpg');


	const meme36 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://pbs.twimg.com/media/DnqyTFjWsAEr78T.jpg');


	const meme37 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://media1.tenor.com/images/2e157785600a39a48a1ae100578ecba3/tenor.gif?itemid=4762746')


	const meme38 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://images3.memedroid.com/images/UPLOADED454/6195c06e320c3.jpeg');


	const meme39 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('http://pm1.narvii.com/6654/e3447a796f1d95c3752e9019f32d6313a5109e14_00.jpg')


	const meme40 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://www.terra.com.mx/u/fotografias/m/2021/11/19/f768x1-28992_29119_82.jpg')


	const meme41 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/428873d0fb3d1333a8ec759d83097979e2575b8f/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f41393673395655657a79773972513d3d2d3236363430343634332e313435353130643063303639626661662e6a7067?s=fit&w=720&h=720');


	const meme42 = new EmbedBuilder()
		.setTitle(" jajaja no tiene sentido. ")
		.setFooter({
			text: "bueno es thor"
		})
		.setColor('#513564')
		.setImage('https://images3.memedroid.com/images/UPLOADED607/5cfb29a9b5637.jpeg')


	const meme43 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.pinimg.com/550x/34/9c/0a/349c0a3e0892a61e3ce4dd975d43047a.jpg')


	const meme44 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://64.media.tumblr.com/d65a6902135da522608d734998a2be59/8330f127341f3427-46/s640x960/bf23c95a9a8ff21833f2d24a84933a7138eb0159.jpg');

	const meme45 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://memesmasgraciosos.com/wp-content/uploads/2021/09/meme-revisa-tu-cuaderno-chicos-y-chicas.jpg')


	const meme46 = new EmbedBuilder()
		.setTitle(" riruka waifu por siempre ")
		.setFooter({
			text: "7u7"
		})
		.setColor('#513564')
		.setImage('https://i.pinimg.com/originals/91/d1/e8/91d1e8b3e8ec273c0d160fe258581223.png')



	const meme47 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.pinimg.com/736x/16/a9/0a/16a90a33758fc1389bed5af6c094ff73.jpg')


	const meme48 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.pinimg.com/564x/62/c2/ca/62c2ca2e6a826fd4669fd11d1da24533.jpg')


	const meme49 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.kym-cdn.com/photos/images/facebook/002/439/262/d67.jfif')


	const meme50 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('http://pm1.narvii.com/7547/c44d68b054f4dc915a14de7e21b6863815d502a4r1-500-500v2_uhq.jpg')


	const meme51 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/ff92d9457d30e15985cbf5ec00822d0ac83fdb76/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f69584753656b4a5873366b6e2d413d3d2d3138372e313632663934313363646331303233653931393931363230313032352e6a7067?s=fit&w=720&h=720');


	const meme52 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://3.bp.blogspot.com/-eQ_Z_o0bVtA/V991sT6uBrI/AAAAAAAAEOU/3sQmkSX1IUMXpJ-TQPKgGHUQPH5B0h6mQCLcB/w1200-h630-p-k-no-nu/fuelamariposameme.JPG')


	const meme53 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://i.imgflip.com/2ky3lq.jpg');

	const meme54 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://www.meme-arsenal.com/memes/806ed604ab813aba9a165bf625854293.jpg')

	const meme55 = new EmbedBuilder()
		.setTitle(" Tu sigue poniendo los memes jojan tu sigue le dire  Riru  ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://pics.onsizzle.com/menciona-una-chica-de-algun-anime-mas-linda-que-rukia-9784549.png');

	const meme56 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://pics.onsizzle.com/fans-del-chihime-fans-delllchiruki-que-durante-anos-se-burlaron-47259141.png');

	const meme57 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://static.wikia.nocookie.net/c981fd36-38b6-43d9-9b43-6215108101cd/scale-to-width/755')

	const meme58 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://img.wattpad.com/682a5205184cfeeff074535a8b398120466aa661/68747470733a2f2f73332e616d617a6f6e6177732e636f6d2f776174747061642d6d656469612d736572766963652f53746f7279496d6167652f4939464951753447376b494a45773d3d2d3236332e313631623264393261353433356561333131353330333339353332322e6a7067?s=fit&w=720&h=720')

	const meme59 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://pbs.twimg.com/media/EZIlk4XXQAAFmef.jpg')

	const meme60 = new EmbedBuilder()
		.setTitle(" no entiendo que es lo gracioso ")
		.setFooter({
			text: ":["
		})
		.setColor('#513564')
		.setImage('https://pm1.narvii.com/6577/1c8ac340dadca4dba1917aae59a291bf186eec2a_hq.jpg')

	//--------------------------------------------------------------------------------------------------------------------  
	if (command === "meme") {
		const number = 60;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [meme1] }); break;
			case 2: message.channel.send({ embeds: [meme2] }); break;
			case 3: message.channel.send({ embeds: [meme3] }); break;
			case 4: message.channel.send({ embeds: [meme4] }); break;
			case 5: message.channel.send({ embeds: [meme5] }); break;
			case 6: message.channel.send({ embeds: [meme6] }); break;
			case 7: message.channel.send({ embeds: [meme7] }); break;
			case 8: message.channel.send({ embeds: [meme8] }); break;
			case 9: message.channel.send({ embeds: [meme9] }); break;
			case 10: message.channel.send({ embeds: [meme10] }); break;
			case 11: message.channel.send({ embeds: [meme11] }); break;
			case 12: message.channel.send({ embeds: [meme12] }); break;
			case 13: message.channel.send({ embeds: [meme13] }); break;
			case 14: message.channel.send({ embeds: [meme14] }); break;
			case 15: message.channel.send({ embeds: [meme15] }); break;
			case 16: message.channel.send({ embeds: [meme16] }); break;
			case 17: message.channel.send({ embeds: [meme17] }); break;
			case 18: message.channel.send({ embeds: [meme18] }); break;
			case 19: message.channel.send({ embeds: [meme19] }); break;
			case 20: message.channel.send({ embeds: [meme20] }); break;
			case 21: message.channel.send({ embeds: [meme21] }); break;
			case 22: message.channel.send({ embeds: [meme22] }); break;
			case 23: message.channel.send({ embeds: [meme23] }); break;
			case 24: message.channel.send({ embeds: [meme24] }); break;
			case 25: message.channel.send({ embeds: [meme25] }); break;
			case 26: message.channel.send({ embeds: [meme26] }); break;
			case 27: message.channel.send({ embeds: [meme27] }); break;
			case 28: message.channel.send({ embeds: [meme28] }); break;
			case 29: message.channel.send({ embeds: [meme29] }); break;
			case 30: message.channel.send({ embeds: [meme30] }); break;
			case 31: message.channel.send({ embeds: [meme31] }); break;
			case 32: message.channel.send({ embeds: [meme32] }); break;
			case 33: message.channel.send({ embeds: [meme33] }); break;
			case 34: message.channel.send({ embeds: [meme34] }); break;
			case 35: message.channel.send({ embeds: [meme35] }); break;
			case 36: message.channel.send({ embeds: [meme36] }); break;
			case 37: message.channel.send({ embeds: [meme37] }); break;
			case 38: message.channel.send({ embeds: [meme38] }); break;
			case 39: message.channel.send({ embeds: [meme39] }); break;
			case 40: message.channel.send({ embeds: [meme40] }); break;
			case 41: message.channel.send({ embeds: [meme41] }); break;
			case 42: message.channel.send({ embeds: [meme42] }); break;
			case 43: message.channel.send({ embeds: [meme43] }); break;
			case 44: message.channel.send({ embeds: [meme44] }); break;
			case 45: message.channel.send({ embeds: [meme45] }); break;
			case 46: message.channel.send({ embeds: [meme46] }); break;
			case 47: message.channel.send({ embeds: [meme47] }); break;
			case 48: message.channel.send({ embeds: [meme48] }); break;
			case 49: message.channel.send({ embeds: [meme49] }); break;
			case 51: message.channel.send({ embeds: [meme51] }); break;
			case 52: message.channel.send({ embeds: [meme52] }); break;
			case 53: message.channel.send({ embeds: [meme53] }); break;
			case 54: message.channel.send({ embeds: [meme54] }); break;
			case 55: message.channel.send({ embeds: [meme55] }); break;
			case 56: message.channel.send({ embeds: [meme56] }); break;
			case 57: message.channel.send({ embeds: [meme57] }); break;
			case 58: message.channel.send({ embeds: [meme58] }); break;
			case 59: message.channel.send({ embeds: [meme59] }); break;
			case 50: message.channel.send({ embeds: [meme50] }); break;
			case 60: message.channel.send({ embeds: [meme60] }); break;


		}
	}
	//-----------------------------------------------------------------------------------
	const cry1 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta llorando')
		.setFooter({
			text: ":["
		})
		.setColor('#808080')
		.setImage('https://media.tenor.com/QI1bpPc2icsAAAAC/anime-cry.gif')

	const cry2 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta llorando')
		.setFooter({
			text: ":["
		})
		.setColor('#808080')
		.setImage('https://c.tenor.com/8VbFP6DpcI8AAAAd/anime-cry.gif')

	const cry3 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta llorando')
		.setFooter({
			text: ":["
		})
		.setColor('#808080')
		.setImage('https://i.pinimg.com/originals/aa/16/f4/aa16f44fb1418be3d46a7ec05b60fd28.gif')

	const cry4 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta llorando')
		.setFooter({
			text: ":["
		})
		.setColor('#808080')
		.setImage('https://www.icegif.com/wp-content/uploads/2024/09/sad-icegif.gif')

	const cry5 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta llorando')
		.setFooter({
			text: ":["
		})
		.setColor('#808080')
		.setImage('https://aniyuki.com/wp-content/uploads/2022/01/aniyuki-anime-girl-crying-gifs-40.gif')

	const cry6 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta llorando')
		.setFooter({
			text: ":["
		})
		.setColor('#808080')
		.setImage('https://p.favim.com/orig/2018/08/31/cry-gif-anime-Favim.com-6203281.gif')

	const cry7 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta llorando')
		.setFooter({
			text: ":["
		})
		.setColor('#808080')
		.setImage('https://gifdb.com/images/thumbnail/sad-anime-hinata-hoshino-4tw4v8j3uj5bo133.gif')

	const cry8 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta llorando')
		.setFooter({
			text: ":["
		})
		.setColor('#808080')
		.setImage('https://i0.wp.com/animeeverything.online/wp-content/uploads/2022/01/violet-evergarden.gif?resize=498%2C276&ssl=1')

	const cry9 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta llorando')
		.setFooter({
			text: ":["
		})
		.setColor('#808080')
		.setImage('https://media.tenor.com/4Tn_0hj7nwgAAAAM/kitagawa-tears.gif')

	//-----------------------------------------------------------------------------------
	if (command === "cry") {
		const number = 9;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [cry1] }); break;
			case 2: message.channel.send({ embeds: [cry2] }); break;
			case 3: message.channel.send({ embeds: [cry3] }); break;
			case 4: message.channel.send({ embeds: [cry4] }); break;
			case 5: message.channel.send({ embeds: [cry5] }); break;
			case 6: message.channel.send({ embeds: [cry6] }); break;
			case 7: message.channel.send({ embeds: [cry7] }); break;
			case 8: message.channel.send({ embeds: [cry8] }); break;
			case 9: message.channel.send({ embeds: [cry9] }); break;

		}
	}

	//--------------------------------------------------------------------------------------

	const sad1 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta triste')
		.setFooter({
			text: ":["
		})
		.setColor('#508080')
		.setImage('https://media.tenor.com/ZgbfJDDS9yQAAAAM/anime-depressed.gif')

	const sad2 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta triste')
		.setFooter({
			text: ":["
		})
		.setColor('#508080')
		.setImage('https://media.tenor.com/jotyiHEoUGUAAAAM/anime.gif')

	const sad3 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta triste')
		.setFooter({
			text: ":["
		})
		.setColor('#508080')
		.setImage('https://i.gifer.com/origin/c3/c3c088c1dbaf514d63f952ffcae35a90.gif')

	const sad4 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta triste')
		.setFooter({
			text: ":["
		})
		.setColor('#508080')
		.setImage('https://media.tenor.com/aY2_MgFvlDUAAAAC/anime-sad.gif')

	const sad5 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta triste')
		.setFooter({
			text: ":["
		})
		.setColor('#508080')
		.setImage('https://media.tenor.com/LEm_Bc072c8AAAAC/sad-anime.gif')

	const sad6 = new EmbedBuilder()
		.setTitle(" sad ")
		.setDescription(message.author.username + ' Esta triste')
		.setFooter({
			text: ":["
		})
		.setColor('#508080')
		.setImage('https://i.gifer.com/AjP.gif')
	//-------------------------------------------------------------------------------------------------


	if (command === "sad") {
		const number = 6;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [sad1] }); break;
			case 2: message.channel.send({ embeds: [sad2] }); break;
			case 3: message.channel.send({ embeds: [sad3] }); break;
			case 4: message.channel.send({ embeds: [sad4] }); break;
			case 5: message.channel.send({ embeds: [sad5] }); break;
			case 6: message.channel.send({ embeds: [sad6] }); break;

		}
	}


	//----------------------------------------------------------------------------------------------------

	const kiss1 = new EmbedBuilder()

		.setDescription(message.author.username + ` Beso a  ${Target.username}`)
		.setFooter({
			text: "se gustan"
		})
		.setColor('#ff0080')
		.setImage('https://acegif.com/wp-content/uploads/anime-kissin-5.gif')

	const kiss2 = new EmbedBuilder()

		.setDescription(message.author.username + ` Beso a  ${Target.username}`)
		.setFooter({
			text: "se gustan"
		})
		.setColor('#ff0080')
		.setImage('https://pa1.narvii.com/6173/d3da59e3ac5fd46d87b5f818cf171f48edc7560a_hq.gif')

	const kiss3 = new EmbedBuilder()

		.setDescription(message.author.username + ` Beso a  ${Target.username}`)
		.setFooter({
			text: "se gustan"
		})
		.setColor('#ff0080')
		.setImage('https://media.tenor.com/tNClex-tMZQAAAAC/kiss-beso.gif')

	const kiss4 = new EmbedBuilder()

		.setDescription(message.author.username + ` Beso a  ${Target.username}`)
		.setFooter({
			text: "se gustan"
		})
		.setColor('#ff0080')
		.setImage('https://64.media.tumblr.com/dc0496ce48c1c33182f24b1535521af2/tumblr_mqku7l4x5O1sqcz4do1_500.gifv')

	const kiss5 = new EmbedBuilder()

		.setDescription(message.author.username + ` Beso a  ${Target.username}`)
		.setFooter({
			text: "se gustan"
		})
		.setColor('#ff0080')
		.setImage('https://i.pinimg.com/originals/f5/3a/dd/f53add041b89b46d4bbc547f6652441d.gif')

	const kiss6 = new EmbedBuilder()

		.setDescription(message.author.username + ` Beso a  ${Target.username}`)
		.setFooter({
			text: "se gustan"
		})
		.setColor('#ff0080')
		.setImage('https://pa1.narvii.com/6120/2d5a229df8e3efa93096ce438cd8477e163c475f_hq.gif')

	const kiss7 = new EmbedBuilder()

		.setDescription(message.author.username + ` Beso a  ${Target.username}`)
		.setFooter({
			text: "se gustan"
		})
		.setColor('#ff0080')
		.setImage('https://i.pinimg.com/originals/84/77/59/84775946c793c41c1f873b3bc442a21a.gif')

	const kiss8 = new EmbedBuilder()

		.setDescription(message.author.username + ` Beso a  ${Target.username}`)
		.setFooter({
			text: "se gustan"
		})
		.setColor('#ff0080')
		.setImage('https://media.tenor.com/Yu-sfUdLMAUAAAAC/koi-to-uso-anime.gif')
	//-------------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "kiss")) {


		const number = 8;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [kiss1] }); break;
			case 2: message.channel.send({ embeds: [kiss2] }); break;
			case 3: message.channel.send({ embeds: [kiss3] }); break;
			case 4: message.channel.send({ embeds: [kiss4] }); break;
			case 5: message.channel.send({ embeds: [kiss5] }); break;
			case 6: message.channel.send({ embeds: [kiss6] }); break;
			case 7: message.channel.send({ embeds: [kiss7] }); break;
			case 8: message.channel.send({ embeds: [kiss8] }); break;



		}
	}
	//--------------------------------------------------------------------------------------------------------------------------

	const hug1 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta abrazando a    ${Target.username}`)
		.setFooter({
			text: "abacho"
		})
		.setColor('#a36970')
		.setImage('http://37.media.tumblr.com/f2a878657add13aa09a5e089378ec43d/tumblr_n5uovjOi931tp7433o1_500.gif')

	const hug2 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta abrazando a    ${Target.username}`)
		.setFooter({
			text: "abacho"
		})
		.setColor('#a36970')
		.setImage('https://i.pinimg.com/originals/4d/aa/87/4daa87a634e1faeee0bb78fbe0f8abca.gif')

	const hug3 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta abrazando a    ${Target.username}`)
		.setFooter({
			text: "abacho"
		})
		.setColor('#a36970')
		.setImage('https://media.tenor.com/iyztKN68avcAAAAM/aharen-san-aharen-san-anime.gif')

	const hug4 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta abrazando a    ${Target.username}`)
		.setFooter({
			text: "abacho"
		})
		.setColor('#a36970')
		.setImage('https://media.tenor.com/oSPZDjEf9vQAAAAM/anime-hug-anime-hugging.gif')

	const hug5 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta abrazando a    ${Target.username}`)
		.setFooter({
			text: "abacho"
		})
		.setColor('#a36970')
		.setImage('https://aniyuki.com/wp-content/uploads/2022/06/anime-hugs-aniyuki-55.gif')

	const hug6 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta abrazando a    ${Target.username}`)
		.setFooter({
			text: "abacho"
		})
		.setColor('#a36970')
		.setImage('https://thumbs.gfycat.com/AlienatedUnawareArcherfish-size_restricted.gif')

	//--------------------------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "hug")) {


		const number = 6;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [hug1] }); break;
			case 2: message.channel.send({ embeds: [hug2] }); break;
			case 3: message.channel.send({ embeds: [hug3] }); break;
			case 4: message.channel.send({ embeds: [hug4] }); break;
			case 5: message.channel.send({ embeds: [hug5] }); break;
			case 6: message.channel.send({ embeds: [hug6] }); break;

		}
	}

	//------------------------------------------------------------------------------------------------------------------------
	//----------------------------------------------------------------------------------------------------------

	const hit1 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta dandole con la silla a` + Target.username)
		.setFooter({
			text: "fighto"
		})
		.setColor('#808000')
		.setImage('https://media.tenor.com/XhdHGRof6WEAAAAC/anime-ataque-golpe-en-la-pared.gif')

	const hit2 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta dandole con la silla a ${Target.username}`)
		.setFooter({
			text: "fighto"
		})
		.setColor('#808000')
		.setImage('http://pa1.narvii.com/6651/514fe5d3769dc1267a5ec7bbe6f643aaa8b2f028_00.gif')


	const hit3 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta dandole con la silla a ${Target.username}`)
		.setFooter({
			text: "fighto"
		})
		.setColor('#808000')
		.setImage('https://i.gifer.com/Nh33.gif')


	const hit4 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta dandole con la silla a ${Target.username}`)
		.setFooter({
			text: "fighto"
		})
		.setColor('#808000')
		.setImage('https://thumbs.gfycat.com/AnxiousAdmirableEnglishsetter-size_restricted.gif')


	const hit5 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta dandole con la silla a ${Target.username}`)
		.setFooter({
			text: "fighto"
		})
		.setColor('#808000')
		.setImage('https://i.gifer.com/N32W.gif')


	const hit6 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta dandole con la silla a ${Target.username}`)
		.setFooter({
			text: "fighto"
		})
		.setColor('#808000')
		.setImage('https://pa1.narvii.com/6142/b5fa64e1ce7d711958ccd7235e855132a61931fe_hq.gif')


	//---------------------------------------------------------------

	if (message.content.includes(prefix + "hit")) {


		const number = 6;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [hit1] }); break;
			case 2: message.channel.send({ embeds: [hit2] }); break;
			case 3: message.channel.send({ embeds: [hit3] }); break;
			case 4: message.channel.send({ embeds: [hit4] }); break;
			case 5: message.channel.send({ embeds: [hit5] }); break;
			case 6: message.channel.send({ embeds: [hit6] }); break;


		}
	}
	//----------------------------------------------------------------------

	//--------------------------------------------------------------------------------------------------------
	const kick1 = new EmbedBuilder()

		.setDescription(message.author.username + ` Pateo a  ${Target.username}`)
		.setFooter({
			text: "pelea"
		})
		.setColor('#ff0080')
		.setImage('https://media.tenor.com/HLx4m-urlBEAAAAC/kick-anime.gif')

	const kick2 = new EmbedBuilder()

		.setDescription(message.author.username + ` Pateo a  ${Target.username}`)
		.setFooter({
			text: "pelea"
		})
		.setColor('#ff0080')
		.setImage('https://media.tenor.com/D5OWYMGcAzAAAAAM/escondido-catedrales.gif')

	const kick3 = new EmbedBuilder()

		.setDescription(message.author.username + ` Pateo a  ${Target.username}`)
		.setFooter({
			text: "pelea"
		})
		.setColor('#ff0080')
		.setImage('https://media.tenor.com/kvxt9X-gXqQAAAAM/anime-clannad.gif')

	const kick4 = new EmbedBuilder()

		.setDescription(message.author.username + ` Pateo a  ${Target.username}`)
		.setFooter({
			text: "pelea"
		})
		.setColor('#ff0080')
		.setImage('https://media.tenor.com/WXJF2QatHA4AAAAM/anime-ouch.gif')

	const kick5 = new EmbedBuilder()

		.setDescription(message.author.username + ` Pateo a  ${Target.username}`)
		.setFooter({
			text: "pelea"
		})
		.setColor('#ff0080')
		.setImage('https://media.tenor.com/icV2ba3gU7MAAAAC/kick-anime.gif')

	const kick6 = new EmbedBuilder()

		.setDescription(message.author.username + ` Pateo a  ${Target.username}`)
		.setFooter({
			text: "pelea"
		})
		.setColor('#ff0080')
		.setImage('https://i.pinimg.com/originals/44/6f/49/446f49e675e38e1bb10d226f12519092.gif')



	//----------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "help")) {

	const help = new EmbedBuilder()
		.setTitle('Comandos \nprefix = *')
		.setDescription(
			"La nueva versión de Yuima quitó varios comandos por su poco uso, estos son los actuales:\n" +
			"\n" +
			"**kiss** = dar un beso\n" +
			"**hug** = dar un abrazo\n" +
			"**waifu** = dar una waifu\n" +
			"**suwaifu** = ver la waifu de tu amigo\n" +
			"**sad** = triste\n" +
			"**cry** = llorar\n" +
			"**pelea** = busca pelea con alguien\n" +
			"**hit** = pégale a alguien\n" +
			"**kick** = patea a alguien\n" +
			"**meme** = un meme random\n" +
			"**f** = muestra tus respetos\n" +
			"**chat** = muestra cómo te deja lo que lees\n" +
			"**miwaifu** = tu waifu\n"
		)
		.setFooter({
			text: "Curiosidad: el comando menos usado de los viejos es el de husbando, nadie quiere husbandos al parecer."
		})
		.setColor("#FF0000")
		.setImage('https://cdn.discordapp.com/attachments/638450747968847928/853702593864007760/Webp.net-gifmaker_3.gif');


	const help1 = new EmbedBuilder()
		.setTitle('Comandos \nprefix = *')
		.setDescription(
			"**husbando** = le da un husbando a tu amigo\n" +
			"**suhusbando** = te dice el husbando de tu amigo\n" +
			"**mihusbando** = te dice tu husbando\n" +
			"**congrats** = felicita a alguien\n" +
			"**ayuda** = si estás pasando por un mal momento y necesitas un mini coach gratuito o sientes ansiedad\n" +
			"**genshin + nombre del personaje** = te da info del personaje (versión clásica con prefijo)\n" +
			"**/play** = toca una canción (no olvides usar el `/`)\n" +
			"\n" +
			"Para saludos de entrada/salida:\n" +
			"Ahora puedes usar **/cambiarentradas** para elegir el canal de bienvenida/despedida.\n" +
			"Si creas un canal llamado **entradas**, el bot también intentará usarlo automáticamente.\n" +
			"\n" +
			"🛡️ **Moderación** (necesitas *Gestionar servidor*):\n" +
			"**seguridad** = ver y cambiar la protección anti-raid / anti-spam\n" +
			"**seguridad ayuda** = todos los subcomandos (umbrales, castigos, roles exentos...)\n" +
			"**seguridad cerrar** / **seguridad abrir** = cierra o abre el servidor a mano ante un raid"
		)
		.setFooter({
			text: "Dato random: Yuima era originalmente morena, pero por no saber colorear la volviste blanca. Ahora existen las dos versiones, así que son hermanas ninja."
		})
		.setColor("#FF0000")
		.setImage('https://cdn.discordapp.com/attachments/1040686328087597169/1074075395512598678/2_girlskunoichitan_twintails_ponytail_red_eyes_ninja_dark-skinned_female_s-3713014042.png');


	const help2 = new EmbedBuilder()
		.setTitle('Comandos de /')
		.setDescription(
			"Solo le agregué el comando de **/buscaranime** + nombre del anime: te da su info y link en AnimeFLV.\n" +
			"Si buscas por ejemplo *one piece* te dará todo lo relacionado, pero si buscas *One Piece Film Z* te dará la película específica.\n" +
			"PD: no me agrada Boa, nadie que patea perritos es muy bueno.\n" +
			"\n" +
			"**/anime** + nombre del anime = igual que /buscaranime pero más directo.\n" +
			"**/genshinarmas** = te da las 3 mejores armas para un personaje de Genshin (las armas pesan más que los artefactos, créeme).\n" +
			"**/genshinartefactos** = te da los mejores sets de artefactos para un personaje de Genshin.\n" +
			"\n" +
			"**/cambiarentradas** = selecciona el canal donde se dará la bienvenida y despedida a la gente del servidor.\n" +
			"\n" +
			"**/codigosgenshin** = códigos actuales de Genshin Impact.\n" +
			"**/codigos_honkai** = códigos de Honkai: Star Rail.\n" +
			"**/codigos_honkai3d** = códigos de Honkai Impact 3rd.\n" +
			"**/codigoszzz** = códigos actuales de Zenless Zone Zero (Nap).\n" +
			"**/mistral** = preguntas a la IA (las clásicas IAS).\n" +
			"\n" +
			"**/combate** = retas a alguien a un combate por turnos.\n" +
			"**/si** / **/no** = aceptas o rechazas el combate.\n" +
			"**/carrera** = inicia una carrera de emoticones.\n" +
			"**/participar** = te unes a la carrera activa.\n" +
			"\n" +
			"**/selectchannel** = selecciona el canal donde se anunciarán los directos de Twitch para este servidor.\n" +
			"**/selecttwitchchannel** = registra el canal de Twitch que quieres que el bot vigile.\n" +
			"\n" +
			"**/navidad** = envía los mensajes de Navidad y Año Nuevo.\n" +
			"**/channel** = muestra el enlace/canal de anuncios principal (según lo que tengas configurado en el bot).\n" +
			"**/registrarglobal** = registra todos los comandos globalmente (solo admins, no lo toques si no sabes qué haces).\n"+
			"**/Playerfornite** = te da las estadisticas y rango de un jugador de fortnite\n"+
			"**/selectgiveaswaychannel** = Selecciona un canal para juegos gratis\n"+
			"**/playermarvel = muestra las estadisticas de una persona en marvel rivals\n"+
			"\n" +
			"🛡️ **/seguridad** = auditoría del servidor: revisa si al bot le faltan permisos, si el servidor "
			+ "tiene la verificación y el 2FA flojos, y cuántos raids, spammers y mensajes se han frenado. "
			+ "Solo lo ves tú salvo que uses la opción `publico`. Requiere *Gestionar servidor*."


		)
		.setFooter({
			text: "El nombre completo de las hermanas Yuima es Dark-Yuima-Jojan y Susa-Yuima-Jojan."
		})
		.setColor("#FF0000")
		.setImage('https://i.imgur.com/v6Ryh1F.png');

	message.channel.send({ embeds: [help] });
	message.channel.send({ embeds: [help1] });
	message.channel.send({ embeds: [help2] });
}

	//-------------------------------------------------------------------------------------
	///--------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "ayuda")) {



		const row = new ActionRowBuilder()
			.addComponents(

				new ButtonBuilder()

					.setLabel('Para la drepresion o necesidad espiritual')
					.setURL("https://groundwire.echoglobal.org/chat/a_Jesus_le_importa")
					.setStyle("Link"),
			);


		message.channel.send({ components: [row] })

	}


	if (message.content.includes(prefix + "nosirvexD")) {



		const row1 = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('primary')
					.setLabel('Ayuda con la bebida')
					.setURL("https://www.aamexico.org.mx/contacto.php")
					.setStyle('Link'),
			);

		message.channel.send({ components: [row1] })

	}


	if (message.content.includes(prefix + "ayuda")) {


		const row = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()

					.setLabel('ayuda con la bebida')
					.setURL("https://www.aamexico.org.mx/contacto.php")
					.setStyle("Link"),
			);



		/*	const row2 = new ActionRowBuilder()
				.addComponents(
					new ButtonBuilder()
					.setCustomId('primary')
					.setLabel('ayuda con la bebida')
			.setURL("https://www.aamexico.org.mx/contacto.php")
						.setStyle(Link),
				);
		*/
		message.channel.send({ components: [row] })
		//message.channel.send({components:[row2]})

	}
	//---------------------------------------------------------------------------------------------
	//----------------------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "kick")) {


		const number = 6;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [kick1] }); break;
			case 2: message.channel.send({ embeds: [kick2] }); break;
			case 3: message.channel.send({ embeds: [kick3] }); break;
			case 4: message.channel.send({ embeds: [kick4] }); break;
			case 5: message.channel.send({ embeds: [kick5] }); break;
			case 6: message.channel.send({ embeds: [kick6] }); break;

		}
	}

	//-----------------------------------------------------------------------------------------------------


	//----------------------------------------------------------------------------------------------------


	if (message.content.includes(prefix + "kick")) {


		const number = 6;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [kick1] }); break;
			case 2: message.channel.send({ embeds: [kick2] }); break;
			case 3: message.channel.send({ embeds: [kick3] }); break;
			case 4: message.channel.send({ embeds: [kick4] }); break;
			case 5: message.channel.send({ embeds: [kick5] }); break;
			case 6: message.channel.send({ embeds: [kick6] }); break;

		}
	}

	//-----------------------------------------------------------------------------------------------------
	const fight1 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta peleando con  ${Target.username}`)
		.setFooter({
			text: "dale con la silla Rin"
		})
		.setColor('#a36080')
		.setImage('https://media.tenor.com/YuR7uAqxHPkAAAAd/fighting-anime.gif')

	const fight2 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta peleando con  ${Target.username}`)
		.setFooter({
			text: "dale con la silla "
		})
		.setColor('#a36080')
		.setImage('https://i.pinimg.com/originals/2b/68/86/2b6886154e707d70332e57ab088a6480.gif')

	const fight3 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta peleando con  ${Target.username}`)
		.setFooter({
			text: "dale con la silla "
		})
		.setColor('#a36080')
		.setImage('https://media.tenor.com/OPLehutf57sAAAAd/anime-fight.gif')

	const fight4 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta peleando con  ${Target.username}`)
		.setFooter({
			text: "dale con la silla oni-sama"
		})
		.setColor('#a36080')
		.setImage('https://media.tenor.com/HfBYNiCQbfkAAAAd/anime-fight.gif')

	const fight5 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta peleando con  ${Target.username}`)
		.setFooter({
			text: "dale con la silla "
		})
		.setColor('#a36080')
		.setImage('https://www.icegif.com/wp-content/uploads/anime-fight-icegif.gif')

	const fight6 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta peleando con  ${Target.username}`)
		.setFooter({
			text: "dale con la silla "
		})
		.setColor('#a36080')
		.setImage('https://thumbs.gfycat.com/BlackandwhiteBadKid-max-1mb.gif')

	const fight7 = new EmbedBuilder()

		.setDescription(message.author.username + ` Esta peleando con  ${Target.username}`)
		.setFooter({
			text: "pelea de invalidos con shorts "
		})
		.setColor('#a36080')
		.setImage('https://media.tenor.com/S_FzNXsiNt8AAAAC/anime-fight.gif')
	//------------------------------------------------------------------------------------------------------------------

	if (message.content.includes(prefix + "pelea")) {


		const number = 7;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [fight1] }); break;
			case 2: message.channel.send({ embeds: [fight2] }); break;
			case 3: message.channel.send({ embeds: [fight3] }); break;
			case 4: message.channel.send({ embeds: [fight4] }); break;
			case 5: message.channel.send({ embeds: [fight5] }); break;
			case 6: message.channel.send({ embeds: [fight6] }); break;
			case 7: message.channel.send({ embeds: [fight7] }); break;

		}
	}


	//----------------------------------------------------------------------------------------------------------------

	//---------------------------------------------------------------------------------------------

	const feli1 = new EmbedBuilder()

		.setDescription(message.author.username + ` Felicidades  ${Target.username}`)
		.setFooter({
			text: "felicidades "
		})
		.setColor('#a36080')
		.setImage('https://thumbs.gfycat.com/ScrawnyPreciousAnaconda-size_restricted.gif')

	const feli2 = new EmbedBuilder()

		.setDescription(message.author.username + ` Felicidades  ${Target.username}`)
		.setFooter({
			text: "felicidades "
		})
		.setColor('#a36080')
		.setImage('https://pa1.narvii.com/6047/5e1f51fcaa719a2bc72d5f853dccc09638f8ec24_hq.gifs')

	const feli3 = new EmbedBuilder()

		.setDescription(message.author.username + ` Felicidades  ${Target.username}`)
		.setFooter({
			text: "felicidades "
		})
		.setColor('#a36080')
		.setImage('https://c.tenor.com/31Bew5jern0AAAAC/congrats-anime.gif')

	const feli5 = new EmbedBuilder()

		.setDescription(message.author.username + ` Felicidades  ${Target.username}`)
		.setFooter({
			text: "felicidades "
		})
		.setColor('#a36080')
		.setImage('https://thumbs.gfycat.com/CleverHiddenBighornedsheep-max-1mb.gif')

	const feli4 = new EmbedBuilder()

		.setDescription(message.author.username + ` Felicidades  ${Target.username}`)
		.setFooter({
			text: "felicidades "
		})
		.setColor('#a36080')
		.setImage('https://2.bp.blogspot.com/-SZSv9PCSFk4/WMsJpuwyXOI/AAAAAAAAxLY/OElV0YfXJ4kppr53FMOZbwoTAGWxP2SUgCPcB/s1600/Omake%2BGif%2BAnime%2B-%2BOne%2BRoom%2B-%2BEpisode%2B10%2B-%2BMoka%2BCongratulations.gif')

	//-------------------------------------------------------------------------------------------------------------------------------


	if (message.content.includes(prefix + "congrats")) {
		const number = 5;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [feli1] }); break;
			case 2: message.channel.send({ embeds: [feli2] }); break;
			case 3: message.channel.send({ embeds: [feli3] }); break;
			case 4: message.channel.send({ embeds: [feli4] }); break;
			case 5: message.channel.send({ embeds: [feli5] }); break;

		}
	}

	//--------------------------------------------------------------------------------------------------------------

	const read1 = new EmbedBuilder()
		.setTitle(" que esta pasando ")
		.setDescription(message.author.username + ' Esta leyendo el chat')
		.setFooter({
			text: "sasasasasas"
		})
		.setColor('Random')
		.setImage('https://media.tenor.com/ITc1hNBSH_wAAAAM/coding-typing.gif')

	const read2 = new EmbedBuilder()
		.setTitle(" que esta pasando ")
		.setDescription(message.author.username + ' Esta leyendo el chat')
		.setFooter({
			text: "sasasasasas"
		})
		.setColor('Random')
		.setImage('https://anymes.files.wordpress.com/2015/01/kona-gif.gif?w=320')

	const read3 = new EmbedBuilder()
		.setTitle(" que esta pasando ")
		.setDescription(message.author.username + ' Esta leyendo el chat')
		.setFooter({
			text: "sasasasasas"
		})
		.setColor('Random')
		.setImage('https://pa1.narvii.com/6981/0e39137b9deffdfef76230a80ed200a858902499r1-540-304_hq.gif')

	const read4 = new EmbedBuilder()
		.setTitle(" que esta pasando ")
		.setDescription(message.author.username + ' Esta leyendo el chat')
		.setFooter({
			text: "sasasasasas"
		})
		.setColor('Random')
		.setImage('https://st1.uvnimg.com/dims4/default/fd8871c/2147483647/thumbnail/480x270/quality/75/format/jpg/?url=https%3A%2F%2Fuvn-brightspot.s3.amazonaws.com%2Fassets%2Fvixes%2Fg%2Fgifit_1496249021373.gif')

	const read5 = new EmbedBuilder()
		.setTitle(" que esta pasando ")
		.setDescription(message.author.username + ' Esta leyendo el chat')
		.setFooter({
			text: "sasasasasas"
		})
		.setColor('Random')
		.setImage('https://media.giphy.com/media/4no7ul3pa571e/giphy.gif')

	const read6 = new EmbedBuilder()
		.setTitle(" que esta pasando ")
		.setDescription(message.author.username + ' Esta leyendo el chat')
		.setFooter({
			text: "sasasasasas"
		})
		.setColor('Random')
		.setImage('https://media.giphy.com/media/HteV6g0QTNxp6/giphy.gif')

	//-------------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "chat")) {


		const number = 6;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [read1] }); break;
			case 2: message.channel.send({ embeds: [read2] }); break;
			case 3: message.channel.send({ embeds: [read3] }); break;
			case 4: message.channel.send({ embeds: [read4] }); break;
			case 5: message.channel.send({ embeds: [read5] }); break;
			case 6: message.channel.send({ embeds: [read6] }); break;

		}
	}

	//----------------------------------------------------------------------------------------------------------

	//----------------------------------------------------------------------
	const f1 = new EmbedBuilder()
		.setTitle(" f ")
		.setDescription(message.author.username + ' f')
		.setFooter({
			text: "f"
		})
		.setColor('#00FF00')
		.setImage('https://media.tenor.com/2bAKt_bnAYMAAAAM/press-f-mg.gif')

	const f2 = new EmbedBuilder()
		.setTitle(" f ")
		.setDescription(message.author.username + ' f')
		.setFooter({
			text: "f"
		})
		.setColor('#00FF00')
		.setImage('https://i.pinimg.com/originals/38/d2/14/38d214c232f7cc550d15bb915a3af406.gif')

	const f3 = new EmbedBuilder()
		.setTitle(" f ")
		.setDescription(message.author.username + ' f')
		.setFooter({
			text: "f"
		})
		.setColor('#00FF00')
		.setImage('https://c.tenor.com/C6OWf1jTlDUAAAAd/sad-anime-letter-f.gif')

	const f4 = new EmbedBuilder()
		.setTitle(" f ")
		.setDescription(message.author.username + ' f')
		.setFooter({
			text: "f"
		})
		.setColor('#00FF00')
		.setImage('https://c.tenor.com/g_smSrfkoLcAAAAC/goku-bowing.gif')

	const f5 = new EmbedBuilder()
		.setTitle(" f ")
		.setDescription(message.author.username + ' f')
		.setFooter({
			text: "f"
		})
		.setColor('#00FF00')
		.setImage('https://c.tenor.com/sa8wvCGXJY8AAAAC/salute-anime.gif')

	const f6 = new EmbedBuilder()
		.setTitle(" f ")
		.setDescription(message.author.username + ' f')
		.setFooter({
			text: "f"
		})
		.setColor('#00FF00')
		.setImage('https://media.tenor.com/b-rNht0eLhIAAAAM/anime-girl-salute.gif')
	//-------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "f")) {


		const number = 6;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {
			case 1: message.channel.send({ embeds: [f1] }); break;
			case 2: message.channel.send({ embeds: [f2] }); break;
			case 3: message.channel.send({ embeds: [f3] }); break;
			case 4: message.channel.send({ embeds: [f4] }); break;
			case 5: message.channel.send({ embeds: [f5] }); break;
			case 6: message.channel.send({ embeds: [f6] }); break;

		}
	}
	//----------------------------------------------------------------------------------------------------

	//-------------------------------------------------------------------------------------

	const waifu01 = new EmbedBuilder()
		.setTitle(" Best waifu claro que si ")
		.setDescription(" Esta waifu es de mi poderosisimo creador el onii-sama de oniis-samas xD y es la mejor de todas   redoble de tambores ponte en señal de respeto " + message.author.username + "Presentando al Onii-sama Jojan5")
		.setFooter({
			text: "jojan5 dice que es best waifu y al que no le guste que se"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/92/68/ea/9268ea18591df5ad21bd184077dbe0dd.jpg');

	const waifu1 = new EmbedBuilder()
		.setTitle(" Best waifu ")
		.setDescription(" esta waifu es de jojan5 lo siento  prueba otra vez " + message.author.username + " suerte pa la proxima  " + Target.username)
		.setFooter({
			text: "jojan5 best waifu y al que no le guste que se"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/92/68/ea/9268ea18591df5ad21bd184077dbe0dd.jpg');


	const waifu2 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "owo"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/30/1a/7a/301a7a9a4b9bc76e9796b65394d318e6.jpg');


	const waifu3 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "owo"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/e5/9f/fa/e59ffaef56a34d23a7b9ace8be291673.jpg');


	const waifu4 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "owo"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/87/db/b7/87dbb710c3a55aeb12ddf18f70c2443b.jpg');


	const waifu5 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  esta gustar a meero " + message.author.username + " toma una waifu ahora vete me molestas   " + Target.username)
		.setFooter({
			text: "owo"
		})
		.setColor('#fe0340')
		.setImage('https://preview.redd.it/34503l0475551.jpg?width=960&crop=smart&auto=webp&s=ff6a853137331c11029c0963dee4b1ed5df477bb');

	const waifu6 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "owo"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/da/01/3b/da013b9687a31d3733c9e61e241ca9c1.jpg');

	const waifu7 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/fb/65/39/fb65397c660d88e1342845ce54d0ab49.jpg');

	const waifu8 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://ae01.alicdn.com/kf/H854f5bf08e1142dfadf39d767b3b9069v/Anime-Demon-Slayer-Kimetsu-no-Yaiba-Susamaru-Kimono-Uniform-Cosplay-Costume-Halloween-Suit-Custom-made-Any.jpg_Q90.jpg_.webp');

	const waifu9 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/f1/50/6e/f1506ea46f6fc29d2e3cd2b2fa3b5f57.jpg');

	const waifu10 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/43/f4/f7/43f4f77b588312b9b7a22bef1bc8c0db.jpg');

	const waifu11 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/d2/28/1d/d2281d4737d55411c4748a9753822e11.jpg');

	const waifu12 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/f7/2b/18/f72b1814d76aafc4adeb82f61bc8cfa2.jpg');

	const waifu13 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/a9/43/db/a943dbbb1a095fa5d39303f7b6f4a7b4.jpg');

	const waifu14 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/d4/c0/70/d4c0702d729629249c6a98e17addf987.jpg');



	const waifu15 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/1b/dd/82/1bdd828924078d21ea403294ef31da7b.jpg');



	const waifu16 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/5b/6b/93/5b6b93446110d9472c5b30384c5de069.jpg');



	const waifu17 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/09/3a/cf/093acfe6179f107603e88d31af595572.jpg');



	const waifu18 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/21/7a/78/217a78e51836c43930d4708367a3e3a6.jpg');



	const waifu19 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/76/8d/7b/768d7b2867b29fa559563585cebf31f3.jpg');

	const waifu20 = new EmbedBuilder()
		.setTitle(" husnabdo  ")
		.setDescription(" Un husbando salvaje aparecio " + message.author.username + " toma tu uke ahora vete me molestas   " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('Random')
		.setImage('https://i.pinimg.com/236x/0e/c2/33/0ec23373b83ee37c4c98c645262715ff.jpg');

	const waifu21 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Wonka dijo gozenlo "
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/10/ed/90/10ed902c15299ec3489adcd18c900b6c.jpg');

	const waifu22 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Wonka dijo gozenlo "
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/236x/ee/11/4a/ee114addc11458f98d2a61e93a72af5c.jpg');

	const waifu23 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Wonka dijo gozenlo "
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/d4/80/d1/d480d186948482ec753552b5e2361bfd.jpg');


	const waifu24 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Wonka dijo gozenlo "
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/564x/1f/71/34/1f7134363269ec06976dbc2eaf3862f2.jpg');

	const waifu25 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Genial premio doble de Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Wonka dijo gozenlo "
		})
		.setColor('#fe0340')
		.setImage('https://pbs.twimg.com/media/DLPW42xXcAAYwMh.jpg');

	const waifu26 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Wonka dijo gozenlo "
		})
		.setColor('#fe0340')
		.setImage('https://arc-anglerfish-arc2-prod-gruporepublica.s3.amazonaws.com/public/OVMWWAQYB5H5HCZ52ZPDHJOKOI.png');

	const waifu27 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Es linda bob esponja"
		})
		.setColor('#fe0340')
		.setImage(' https://i.pinimg.com/originals/98/a8/b9/98a8b91d019c9a7cd032b38768a045e4.jpg');

	const waifu28 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Es linda bob esponja"
		})
		.setColor('#fe0340')
		.setImage('  https://ae01.alicdn.com/kf/HTB14jhUX5MnBKNjSZFzq6A_qVXat/2017-New-Japanese-Anime-Miss-Kobayashi-s-Dragon-Maid-Kanna-Kamui-Cosplay-Costumes-Halloween-Party-Kawai.jpg');

	const waifu29 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Es linda bob esponja"
		})
		.setColor('#fe0340')
		.setImage('https://pbs.twimg.com/media/E0dUYVsVIAEf9eE.jpg');

	const waifu30 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Es linda bob esponja"
		})
		.setColor('#fe0340')
		.setImage('https://cdn.worldcosplay.net/592935/lkzlaxommbhepfytyyzvnjvdladftkvwzzblgxkx-740.jpg');

	const waifu31 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Es linda bob esponja"
		})
		.setColor('#fe0340')
		.setImage('http://pm1.narvii.com/6152/c50a48ea38a45a55ab61d5cfcefd1468dc9f8f87_00.jpg');

	const waifu32 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Es linda bob esponja"
		})
		.setColor('#fe0340')
		.setImage('https://cdn.worldcosplay.net/294979/ygbwxyzvpbpperelwhepvazradfeevljhvbglboq-740.jpg');

	const waifu33 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Es linda bob esponja"
		})
		.setColor('#fe0340')
		.setImage('https://pbs.twimg.com/media/ELVjXi4WsAEbcMV.jpg');

	const waifu34 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "Es linda bob esponja"
		})
		.setColor('#fe0340')
		.setImage('https://i.pinimg.com/736x/25/4f/d7/254fd76a32709724be1708259712ebbe.jpg');

	const waifu35 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setFooter({
			text: "Genial premio triple "
		})
		.setColor('#fe0345')
		.setImage('https://static.wikia.nocookie.net/cartoon-network-scoobydoo-mystery-incorporated/images/b/ba/107TheyCan.png/revision/latest?cb=20190316003210');

	const waifu36 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setFooter({
			text: "Es Bellisima"
		})
		.setColor('#fe0345')
		.setImage('https://static.wikia.nocookie.net/fairytail/images/1/18/Lucy_Apariencia_X792.png/revision/latest?cb=20181126013015&path-prefix=es');


	const waifu37 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setFooter({
			text: "Es Bellisima"
		})
		.setColor('#fe0345')
		.setImage('https://www.seekpng.com/png/detail/948-9483743_erza-scarlet-images-erza-scarlet-hd-wallpaper-and.png');


	const waifu38 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setFooter({
			text: "Es Bellisima"
		})
		.setColor('#fe0345')
		.setImage('https://i.pinimg.com/originals/5d/5e/db/5d5edbf1b60f7c052ac9a117fb2c91b1.jpg');

	const waifu39 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setFooter({
			text: "Es Bellisima"
		})
		.setColor('#fe0345')
		.setImage('https://64.media.tumblr.com/3cff9433aa6aee6ad92ca468c3eef862/d4e0a273369880dd-b3/s250x400/8237d5d06314fbf45d44a18f2b116e1fbe50ca83.png');

	const waifu40 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setFooter({
			text: "Es Bellisima"
		})
		.setColor('#fe0345')
		.setImage('https://pbs.twimg.com/profile_images/1358177931877617670/h7LWjhqW.jpg');

	const waifu41 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@Glossyincosplay', inline: true })
		.setFooter({
			text: "La llevare a casa con mama"
		})
		.setColor('#fe0345')

		.setImage('https://preview.redd.it/7qbtem327nt91.jpg?width=640&crop=smart&auto=webp&s=8ee645322454d3687511488bcae43a9e27da4d83');


	const waifu42 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@@大冰丘丘', inline: true })
		.setFooter({
			text: "La llevare a casa con mama"
		})
		.setColor('#fe0345')
		.setImage('https://64.media.tumblr.com/50c9caf4314f7cb4ca2771143503ace4/ce340748aac2d6e0-bf/s1280x1920/2bc3c80bd946d7ce2d3494549e49dd3f74a57d24.jpg');



	const waifu43 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@@大冰丘丘', inline: true })
		.setFooter({
			text: "La llevare a casa con mama"
		})
		.setColor('#fe0345')
		.setImage('https://64.media.tumblr.com/69416c7394b7e3cc22154af1f05d45c1/bed96021cd4ec3e1-c6/s2048x3072/27a3086757071f2f300564b421be7de18cd92c03.jpg');


	//----------------------------------

	const waifu44 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@@大冰丘丘', inline: true })
		.setFooter({
			text: "La llevare a casa con mama"
		})
		.setColor('#fe0345')
		.setImage('https://64.media.tumblr.com/2ea6f5f6ebd4d451cfb9f36b370ecf96/fb747ea914b6ef70-f1/s400x600/51a54899f51e82e4d54b0a82f885f48364496faf.jpg');



	const waifu45 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@Kei_takasugi_', inline: true })
		.setFooter({
			text: "La llevare a casa con mama"
		})
		.setColor('#fe0345')
		.setImage('https://preview.redd.it/2x68f2bk6ty91.jpg?width=640&crop=smart&auto=webp&s=e26a3cdba40344ff7e89c38d768d1f0e6d1dc556');

	const waifu46 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@Kei_takasugi_', inline: true })
		.setFooter({
			text: "La llevare a casa con mama"
		})
		.setColor('#fe0345')
		.setImage('https://preview.redd.it/chfojv2udtg81.jpg?width=640&crop=smart&auto=webp&s=eadcb8bbb4fd1262bbb7fc6f11e971999e203f0a');

	const waifu47 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@luce_cosplay', inline: true })
		.setFooter({
			text: "La llevare a casa con mama"
		})
		.setColor('#fe0345')
		.setImage('https://preview.redd.it/ygtadbu0ctz91.jpg?width=640&crop=smart&auto=webp&s=6478984e8245920acb61886307cabc80f5cfb648');

	const waifu48 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@luce_cosplay', inline: true })
		.setFooter({
			text: "La llevare a casa con mama"
		})
		.setColor('#fe0345')
		.setImage('https://preview.redd.it/ilpat9lyvzz71.jpg?width=640&crop=smart&auto=webp&s=d26ec09a87a7af2c09fff946052c7c19dcef4b7b');

	const waifu49 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@luce_cosplay', inline: true })
		.setFooter({
			text: "La llevare a casa con mama"
		})
		.setColor('#fe0345')
		.setImage('https://preview.redd.it/o7kgaysdmap71.jpg?width=640&crop=smart&auto=webp&s=7b59ab76db6083a6800a1c670d47e127417b5d3c');


	const waifu50 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@@大冰丘丘', inline: true })
		.setFooter({
			text: "La llevare a casa con mama"
		})
		.setColor('#fe0345')
		.setImage('https://64.media.tumblr.com/d45df26b5496c3103143ae02a689beb8/0fd45421731345b9-5e/s2048x3072/ace11fb802ffc692b40fb34ad98004e9d9d7bcb0.jpg');



	const waifu51 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@bellatrixaiden', inline: true })
		.setFooter({
			text: "Que femenina"
		})
		.setColor('#fe0345')
		.setImage('https://external-preview.redd.it/8_PPwAAsV-7dKUMEwxSDj4OOC4P1tF2sMHVDTgDLtdM.jpg?width=640&crop=smart&auto=webp&s=751ecf0e057e0428e4510f7c496680a091a31d8f');



	const waifu52 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@bellatrixaiden', inline: true })
		.setFooter({
			text: "Que femenina"
		})
		.setColor('#fe0345')
		.setImage('https://external-preview.redd.it/Zrfx1lxeCi0-4apc9tZshFxrYKntaFZC6l8FyQOvTzs.jpg?width=640&crop=smart&auto=webp&s=8c99a47d872b99c9ce9192c2f4082124dcb9d054');


	const waifu53 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@bellatrixaiden', inline: true })
		.setFooter({
			text: "Que femenina"
		})
		.setColor('#fe0345')
		.setImage('https://external-preview.redd.it/11neln8xL9cY0GpICNlp4uOZc69VUKyX2IukURCKlqU.jpg?width=640&crop=smart&auto=webp&s=b4b71cd86e1b51a9ab9a2243ff37a1d700fb42c5');




	const waifu54 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@izanamitan', inline: true })
		.setFooter({
			text: "Que femenina"
		})
		.setColor('#fe0345')
		.setImage('https://preview.redd.it/g1a8o5732c1a1.jpg?width=640&crop=smart&auto=webp&s=1dc6e0f1d64f79602eef59336a730f7215fee4a0');


	const waifu55 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@izanamitan', inline: true })
		.setFooter({
			text: "Que femenina"
		})
		.setColor('#fe0345')
		.setImage('https://preview.redd.it/xymnjfw6w50a1.jpg?width=640&crop=smart&auto=webp&s=c39e3bcb524c0f3fc8a80a3e78ab03f228bf6fe8');


	const waifu56 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@241x09', inline: true })
		.setFooter({
			text: "Quiero respetarla"
		})
		.setColor('#fe0345')
		.setImage('https://preview.redd.it/fcc9hf2p0kja1.jpg?width=640&crop=smart&auto=webp&v=enabled&s=bcd7412e93c52fe906e1309fd93052a365a35058');

	const waifu57 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@241x09', inline: true })
		.setFooter({
			text: "Quiero respetarla"
		})
		.setColor('#fe0345')
		.setImage('https://preview.redd.it/e32vstwrqck91.jpg?width=640&crop=smart&auto=webp&v=enabled&s=77c66368ae814da1d8b9ece854adec4dce819dca');

	const waifu58 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Tu compa el " + message.author.username + " te da esta waifu toma  " + Target.username)
		.setThumbnail('https://preview.redd.it/e32vstwrqck91.jpg?width=640&crop=smart&auto=webp&v=enabled&s=77c66368ae814da1d8b9ece854adec4dce819dca')
		.addFields({ name: 'instagram', value: '@241x09', inline: true })
		.setFooter({
			text: "Quiero respetarla"
		})
		.setColor('#fe0345')
		.setImage('https://preview.redd.it/g2zpzmz3dzh81.jpg?width=640&crop=smart&auto=webp&v=enabled&s=edc2a5fd2869cd309042dd57a2902a859baf2852');



	const waifu59 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://cdn.discordapp.com/attachments/534587203947593738/1078143144635400342/juvia-juvia-lockser.gif');


	const waifu60 = new EmbedBuilder()
		.setTitle(" Waifus ")
		.setDescription(" Waifus si tu amigo  " + message.author.username + " Te esta dando una waifu siii ahora vete me molestas  " + Target.username)
		.setFooter({
			text: "GRRRRRR"
		})
		.setColor('#fe0340')
		.setImage('https://cdn.discordapp.com/attachments/786421187755638815/1078143191536107621/3bed928dbf8cf64f32a90e2bb64b57cb1656495876_main.png');


	//-------------------------------------------------------------------------------------------------------------------------			    


	if (message.content.includes(prefix + "miwaifu") && client.waifu[message.author.username] != null) {
		let _message = client.waifu[message.author.username].message;
		message.channel.send("Tu waifu " + message.author.username + " es : " + _message);

	}

	if (message.content.includes(prefix + "miwaifu") && client.waifu[message.author.username] == null) {

		message.channel.send("Tu no tienes waifu " + message.author.username + " pidele a alguien que te de una ");
	}
	//--------------------------------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "suwaifu") && mention == null) {
		message.channel.send("Tienes que mencionar a alguien onii-chan :[");

	}
	//-------------------------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "suwaifu") && (Target.username)
		&& client.waifu[Target.username] != null) {

		let _message = client.waifu[Target.username].message;
		message.channel.send("Su waiffu " + Target.username + " es : " + _message);

	}
	//-------------------------------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "suwaifu") && (Target.username)
		&& client.waifu[Target.username] == null) {

		message.channel.send("Tu no tienes waifu " + Target.username + " pidele a alguien que te de una ");

	}

	//----------------------------------------------------------------------------------------------------------------------







	//---------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "waifu") && (Target.username) && Target.username == "jojan5") {
		message.channel.send({ embeds: [waifu01] });
		return;
	}

	if (message.content.includes(prefix + "waifu") && (Target.username) && Target.username == "OmegaRaizen") {
		message.channel.send({ embeds: [waifu59] });
		return;
	}

	if (message.content.includes(prefix + "waifu") && (Target.username) && Target.username.username != "jojan5") {

		/* if(message.author.username *= "jojan5"){
			   message.channel.send(waifu01);
		   }
		   if( Target.username *= "jojan5"){
			   message.channel.send(waifu01);
		   }
		   else{*/
		/*  if(message.author.user !== "jojan5"){
			  message.channel.send(waifu01); 
			  return false;
		  }*/
		/*if( Target.username == "jojan5"){
			message.channel.send(waifu01);
			return;
		}*/
		// else{

		if (message.author.username == Target.username) {
			message.channel.send("no puedes darte una auto waifu eso es trampa onii-san :{");
			return;
		}

		const number = 60;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {

			case 1: message.channel.send({ embeds: [waifu1] });
				{
					editmessage = ("Sorry patito es del jojan :[")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 2: message.channel.send({ embeds: [waifu2] }); {
				editmessage = ("Nezuco")
				client.waifu[user.username] = {
					message: editmessage
				}
			} break;
			case 3: message.channel.send({ embeds: [waifu3] });
				{
					editmessage = ("Mitsuri Kanroji")
					client.waifu[user.username] = {
						message: editmessage
					}
				}

				break;
			case 4: message.channel.send({ embeds: [waifu4] });
				{
					editmessage = ("Ahri")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 5: message.channel.send({ embeds: [waifu5] });
				{
					editmessage = ("Neeko")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 6: message.channel.send({ embeds: [waifu6] });
				{
					editmessage = ("Saber, Arthuria")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 7: message.channel.send({ embeds: [waifu7] });
				{
					editmessage = ("Yuroichi")
					client.waifu[Target.username.username] = {
						message: editmessage
					}
				} break;
			case 8: message.channel.send({ embeds: [waifu8] });
				{
					editmessage = ("Susamaru")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 9: message.channel.send({ embeds: [waifu9] });
				{
					editmessage = ("Boohu")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 10: message.channel.send({ embeds: [waifu10] });
				{
					editmessage = ("Maid sama")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 11: message.channel.send(waifu11);
				{
					editmessage = ("Toshaka Rin")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 12: message.channel.send({ embeds: [waifu12] });
				{
					editmessage = ("Xayah")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 13: message.channel.send({ embeds: [waifu13] });
				{
					editmessage = ("Yumeko")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 14: message.channel.send({ embeds: [waifu14] });
				{
					editmessage = ("Tifa")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 15: message.channel.send({ embeds: [waifu15] });
				{
					editmessage = ("Orihime Inove")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 16: message.channel.send({ embeds: [waifu16] });
				{
					editmessage = ("Sonic")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 17: message.channel.send({ embeds: [waifu17] });
				{
					editmessage = ("Dark Saber")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 18: message.channel.send({ embeds: [waifu18] });
				{
					editmessage = ("Dark Saber")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 19: message.channel.send({ embeds: [waifu19] });
				{
					editmessage = ("Shiro")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 20: message.channel.send({ embeds: [waifu20] });
				{
					editmessage = ("Ace D")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 21: message.channel.send({ embeds: [waifu21] });
				{
					editmessage = ("hellscythe")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 22: message.channel.send({ embeds: [waifu22] });
				{
					editmessage = ("Noel")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 23: message.channel.send({ embeds: [waifu23] });
				{
					editmessage = ("Ty Lee")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 24: message.channel.send({ embeds: [waifu24] });
				{
					editmessage = ("Videl")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 25: message.channel.send({ embeds: [waifu25] });
				{
					editmessage = ("Kale y Caulifa")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 26: message.channel.send({ embeds: [waifu26] });
				{
					editmessage = ("Androide 21")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 27: message.channel.send({ embeds: [waifu27] });
				{
					editmessage = ("Miku Nakano")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 28: message.channel.send({ embeds: [waifu28] });
				{
					editmessage = ("Kana")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 29: message.channel.send({ embeds: [waifu29] });
				{
					editmessage = ("Airi Gotou")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 30: message.channel.send({ embeds: [waifu30] });
				{
					editmessage = ("Shiba Miyuki")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 31: message.channel.send({ embeds: [waifu31] });
				{
					editmessage = ("Hestia")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 32: message.channel.send({ embeds: [waifu32] });
				{
					editmessage = ("Ais Wallenstein")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 33: message.channel.send({ embeds: [waifu33] });
				{
					editmessage = ("Nami chuan")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 34: message.channel.send({ embeds: [waifu34] });
				{
					editmessage = ("Zelda")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;
			case 35: message.channel.send({ embeds: [waifu35] });
				{
					editmessage = ("Las hex girls")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 36: message.channel.send({ embeds: [waifu36] });
				{
					editmessage = ("Lucy heartfilia")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 37: message.channel.send({ embeds: [waifu37] });
				{
					editmessage = ("Erza Scarlet")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 38: message.channel.send({ embeds: [waifu38] });
				{
					editmessage = ("Kana")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 39: message.channel.send({ embeds: [waifu39] });
				{
					editmessage = ("Daphne Blake")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 40: message.channel.send({ embeds: [waifu40] });
				{
					editmessage = ("Asami Sato")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 41: message.channel.send({ embeds: [waifu41] });
				{
					editmessage = ("Nazuna Nanakusa")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 42: message.channel.send({ embeds: [waifu42] });
				{
					editmessage = ("Hu tao")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;


			case 43: message.channel.send({ embeds: [waifu43] });
				{
					editmessage = ("Signora")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 44: message.channel.send({ embeds: [waifu44] });
				{
					editmessage = ("Yae Miko")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 45: message.channel.send({ embeds: [waifu45] });
				{
					editmessage = ("Marin")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 46: message.channel.send({ embeds: [waifu46] });
				{
					editmessage = ("Mikasa y tiene vestido de boda")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 47: message.channel.send({ embeds: [waifu47] });
				{
					editmessage = ("Lisa")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;


			case 48: message.channel.send({ embeds: [waifu48] });
				{
					editmessage = ("Yennefer")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 49: message.channel.send({ embeds: [waifu49] });
				{
					editmessage = ("Miss fortune")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 50: message.channel.send({ embeds: [waifu50] });
				{
					editmessage = ("Kurumi")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;


			case 51: message.channel.send({ embeds: [waifu51] });
				{
					editmessage = ("ningguang")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;


			case 52: message.channel.send({ embeds: [waifu52] });
				{
					editmessage = ("Boa Hanckoc")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;


			case 53: message.channel.send({ embeds: [waifu53] });
				{
					editmessage = ("Violet Evergarden")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 54: message.channel.send({ embeds: [waifu54] });
				{
					editmessage = ("Ganyu")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 55: message.channel.send({ embeds: [waifu55] });
				{
					editmessage = ("Himeno")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 56: message.channel.send({ embeds: [waifu56] });
				{
					editmessage = ("Shenhe")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 57: message.channel.send({ embeds: [waifu57] });
				{
					editmessage = ("Historia")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 58: message.channel.send({ embeds: [waifu58] });
				{
					editmessage = ("Beidou")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 59: message.channel.send({ embeds: [waifu59] });
				{
					editmessage = ("juvia lockster")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;

			case 60: message.channel.send({ embeds: [waifu60] });
				{
					editmessage = ("Gamma")
					client.waifu[user.username] = {
						message: editmessage
					}
				} break;










		}


	}
	if (message.content.includes(prefix + "waifu") && mention == null) {
		message.channel.send("no puedes darte una auto waifu eso es trampa onii-san :{ menciona a alguien porfavor");

	}

	//----------------------------------------------------------------------------------------------------
	//----------------------------------------------------------------------------------------------------



	//----------------------------------------------------------------------------------------------------------------------------------------------
	const husbando1 = new EmbedBuilder()
		.setTitle(" UFF ")
		.setDescription("Tu amigo " + message.author.username + " te esta dando este Husbando ahora vete me molestas")
		.setFooter({
			text: "debo admitir que me calienta mas que el son en verano"
		})
		.setColor('#0000ff')
		.setImage('https://i.pinimg.com/originals/75/04/d1/7504d1f6014f009d76293b5178c40fa5.png');

	const husbando2 = new EmbedBuilder()
		.setTitle(" UFF ")
		.setDescription("Tu amigo " + message.author.username + " te esta dando este Husbando ahora vete me molestas")
		.setFooter({
			text: "debo admitir que me calienta mas que el son en verano"
		})
		.setColor('#0000ff')
		.setImage('https://pbs.twimg.com/media/EtAdfX0XAAE7iva.jpg');

	const husbando3 = new EmbedBuilder()
		.setTitle(" UFF ")
		.setDescription("Tu amigo " + message.author.username + " te esta dando este Husbando ahora vete me molestas")
		.setFooter({
			text: "debo admitir que me calienta mas que el son en verano"
		})
		.setColor('#0000ff')
		.setImage('https://neoverso.com/wp-content/uploads/2011/02/grayson_by_bluebird0020-d2ygw0p.jpg');

	const husbando4 = new EmbedBuilder()
		.setTitle(" UFF ")
		.setDescription("Tu amigo " + message.author.username + " te esta dando este Husbando ahora vete me molestas")
		.setFooter({
			text: "debo admitir que me calienta mas que el son en verano"
		})
		.setColor('#0000ff')
		.setImage('https://data.whicdn.com/images/333386362/original.jpg');

	const husbando5 = new EmbedBuilder()
		.setTitle(" UFF ")
		.setDescription("Tu amigo " + message.author.username + " te esta dando este Husbando ahora vete me molestas")
		.setFooter({
			text: "debo admitir que me calienta mas que el son en verano"
		})
		.setColor('#0000ff')
		.setImage('http://pm1.narvii.com/6268/272bbd43d65648947474e9ec70bb29ee67a44fb2_00.jpg');

	const husbando6 = new EmbedBuilder()
		.setTitle(" UFF ")
		.setDescription("Tu amigo " + message.author.username + " te esta dando este Husbando ahora vete me molestas")
		.setFooter({
			text: "debo admitir que me calienta mas que el son en verano"
		})
		.setColor('#0000ff')
		.setImage('https://cdn.worldcosplay.net/574271/mokqipxddpeshckswogxdokaivjstnxjsdmpgxua-740.jpg');

	const husbando7 = new EmbedBuilder()
		.setTitle(" UFF ")
		.setDescription("Tu amigo " + message.author.username + " te esta dando este Husbando ahora vete me molestas")
		.setFooter({
			text: "debo admitir que me calienta mas que el son en verano"
		})
		.setColor('#0000ff')
		.setImage('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQCak_YafOz3PrwsrifoWkActSnK5e4rcU2PtOPG2H1BRD8xumtHweRwYTjO2Nf9OdHpdk&usqp=CAU');

	const husbando8 = new EmbedBuilder()
		.setTitle(" UFF ")
		.setDescription("Tu amigo " + message.author.username + " te esta dando este Husbando ahora vete me molestas")
		.setFooter({
			text: "debo admitir que me calienta mas que el son en verano"
		})
		.setColor('#0000ff')
		.setImage('https://cl.buscafs.com/www.tomatazos.com/public/uploads/images/326347/326347_1140x516.jpg');

	const husbando9 = new EmbedBuilder()
		.setTitle(" UFF ")
		.setDescription("Tu amigo " + message.author.username + " te esta dando este Husbando ahora vete me molestas")
		.setFooter({
			text: "debo admitir que me calienta mas que el son en verano"
		})
		.setColor('#0000ff')
		.setImage('https://preview.redd.it/52sj34y4qdz91.jpg?width=640&crop=smart&auto=webp&s=3d1bbe8facfe39cdd9db42340473c7b9bc29ed75');

	//-----------------------------------------------------------------------------------------------------------------------


	const husbando10 = new EmbedBuilder()
		.setTitle(" Husbandos ")
		.setDescription(" Tu amigo " + message.author.username + " te da este husbando " + Target.username)
		.setThumbnail('https://neozink.com/resources/blog/Instagram-IG-Logo.jpg')
		.addFields({ name: 'instagram', value: '@jibberjabbar', inline: true })
		.addFields({ name: 'TikTok', value: '@jibberjabbar_', inline: true })
		.setFooter({
			text: "Que hombre"
		})
		.setColor('#0000ff')
		.setImage('https://preview.redd.it/yqxv28e3b73a1.jpg?width=640&crop=smart&auto=webp&s=a3d7b233bf9d3faf1cd0c110b233308fd633b692');


	//-----------------------------------------------------------------------------------------------------------------------

	if (message.content.includes(prefix + "mihusbando") && client.husbando[message.author.username] != null) {
		let _message = client.husbando[message.author.username];
		message.channel.send("Tu husbando " + message.author.username + " es : " + _message);

	}

	if (message.content.includes(prefix + "mihusbando") && client.husbando[message.author.username] == null) {

		message.channel.send("Tu no tienes husbando " + message.author.username + " pidele a alguien que te de uno ");

	}

	//--------------------------------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "suhusbando") && mention == null) {
		message.channel.send("Tienes que mencionar a alguien one-san:[");

	}
	//-------------------------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "suhusbando") && (Target.username)
		&& client.husbando[message.mentions.users.first().username] != null) {

		let _message = client.husbando[message.mentions.users.first().username].message;
		message.channel.send("Su husbando " + Target.username + " es : " + _message);

	}

	/* 
			 let _message = client.waifu[Target.username.username].message;
			 message.channel.send ("Su waiffu " + Target.username + " es : " + _message);*/
	//-------------------------------------------------------------------------------------------------------------------------
	if (message.content.includes(prefix + "suhusbando") && (Target.username)
		&& client.husbando[Target.username] == null) {

		message.channel.send("Tu no tienes husbando " + Target.username + " pidele a alguien que te de uno ");

	}

	//----------------------------------------------------------------------------------------------------------------------




	if (message.content.includes(prefix + "husbando") && (Target.username) && Target.username == "jojan5") {
		message.channel.send({ embeds: [waifu01] });
		editmessage = ("No es husbando es Riruka Dokugamine")
		client.husbando[message.mentions.users.first().username] = {
			message: editmessage
		}
		return;
	}
	if (message.content.includes(prefix + "husbando") && (Target.username) && Target.username.username != "jojan5") {
		number = 10;

		var random = Math.floor(Math.random() * (number - 1 + 1)) + 1;

		switch (random) {

			case 1: message.channel.send({ embeds: [husbando1] });
				{
					editmessage = ("Ace D")
					client.husbando[message.mentions.users.first().username] = {
						message: editmessage
					}
				} break;

			case 2: message.channel.send({ embeds: [husbando2] });
				{
					editmessage = ("Tadashi hamada")
					client.husbando[message.mentions.users.first().username] = {
						message: editmessage
					}
				} break;

				message.channel.send({ embeds: [husbando3] });
				{
					editmessage = ("Nightwing")
					client.husbando[message.mentions.users.first().username] = {
						message: editmessage
					}
				} break;

				message.channel.send({ embeds: [husbando4] });
				{
					editmessage = ("Usui")
					client.husbando[message.mentions.users.first().username] = {
						message: editmessage
					}
				} break;

			case 5: message.channel.send({ embeds: [husbando5] });
				{
					editmessage = ("Felix")
					client.husbando[message.mentions.users.first().username] = {
						message: editmessage
					}
				} break;

			case 6: message.channel.send({ embeds: [husbando6] });
				{
					editmessage = ("Fred jones")
					client.husbando[message.mentions.users.first().username] = {
						message: editmessage
					}
				} break;

			case 7: message.channel.send({ embeds: [husbando7] });
				{
					editmessage = ("Superman")
					client.husbando[Target.username.username] = {
						message: editmessage
					}
				} break;

			case 8: message.channel.send({ embeds: [husbando8] });
				{
					editmessage = ("zuko")
					client.husbando[message.mentions.users.first().username] = {
						message: editmessage
					}
				} break;


			case 9: message.channel.send({ embeds: [husbando9] });
				{
					editmessage = ("Venti")
					client.husbando[message.mentions.users.first().username] = {
						message: editmessage
					}
				} break;


			case 10: message.channel.send({ embeds: [husbando10] });
				{
					editmessage = ("Kaeya")
					client.husbando[message.mentions.users.first().username] = {
						message: editmessage
					}
				} break;


		}
	}


	if (message.content.includes(prefix + "husbando") && mention == null) {
		message.channel.send("no puedes darte un auto husbando eso es trampa onii-san :{ menciona a alguien porfavor");

	}
	if (message.content.startsWith(prefix + "nuevohusbando")) {
		editmessage = message.content.slice(14);


		client.husbando[message.author.username] = {
			message: editmessage
		}
		fs.writeFile("./husbando.json", JSON.stringify(client.husbando, null, 4), err => {
			if (err) throw err;
			message.channel.send("Husbando agregado!");
		});
	}





	//------------------------------------------------------------------------------------------------------------------
})



//--------------------------------------------------------------------------
