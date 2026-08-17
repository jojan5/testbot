// ==============================
//  MÓDULO ANTI-RAID / ANTI-SPAM
//  Se engancha solo: require('./security/antiraid').init(client)
//  Configuración por servidor en security-config.json
// ==============================

const fs = require('fs');
const path = require('path');
const {
	Events,
	EmbedBuilder,
	AttachmentBuilder,
	PermissionFlagsBits,
	GuildVerificationLevel,
	SlashCommandBuilder,
} = require('discord.js');

const CONFIG_FILE = path.join(__dirname, '..', 'security-config.json');
const PREFIX = '*';

// Discord no permite timeouts de más de 28 días
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

const DEFAULTS = {
	enabled: true,
	logChannelId: null,

	// --- anti-raid (avalancha de entradas) ---
	joinThreshold: 6, // entradas...
	joinWindowMs: 12000, // ...dentro de esta ventana => raid
	lockdownMinutes: 10,
	raidAction: 'timeout', // timeout | kick | ban | log

	// --- filtro de cuentas recién creadas ---
	minAccountAgeDays: 7,
	newAccountAction: 'log', // timeout | kick | log

	// --- anti-spam de mensajes ---
	msgThreshold: 6, // mensajes...
	msgWindowMs: 6000, // ...dentro de esta ventana => spam
	duplicateThreshold: 3, // mismo texto repetido
	mentionLimit: 6, // menciones en un solo mensaje
	everyoneMinDays: 30, // días que hay que llevar para poder usar @everyone (0 = sin filtro)
	timeoutMinutes: 10, // castigo por spam
	blockInvites: true,

	// Imagen del aviso. Si es null se adjunta assets/seguridad.gif del repo,
	// porque los enlaces del CDN de Discord llevan firma y caducan.
	alertImageUrl: null,

	exemptRoleIds: [],
};

// ==============================
//  PERSISTENCIA
// ==============================

let config = {};

try {
	config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
	console.log('[SEGURIDAD] Configuración cargada.');
} catch {
	console.log('[SEGURIDAD] No hay security-config.json, se creará al guardar.');
	config = {};
}

function saveConfig() {
	try {
		fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
	} catch (err) {
		console.error('[SEGURIDAD] No se pudo guardar security-config.json:', err.message);
	}
}

function getGuildConfig(guildId) {
	if (!config[guildId]) config[guildId] = { ...DEFAULTS };
	// Rellena claves nuevas si el archivo viene de una versión anterior
	for (const [key, value] of Object.entries(DEFAULTS)) {
		if (config[guildId][key] === undefined) config[guildId][key] = value;
	}
	return config[guildId];
}

// ==============================
//  ESTADO EN MEMORIA
// ==============================

const joinLog = new Map(); // guildId -> [timestamp, ...]
const lockdowns = new Map(); // guildId -> { until, previousLevel, timer }
const msgLog = new Map(); // `${guildId}:${userId}` -> { times: [], contents: [], messages: [] }
const raidJoiners = new Map(); // guildId -> Set<userId> que entraron durante el raid
const stats = new Map(); // guildId -> contadores desde el arranque

const ARRANQUE = Date.now();

function getStats(guildId) {
	if (!stats.has(guildId)) {
		stats.set(guildId, {
			raids: 0,
			castigados: 0,
			mensajesBorrados: 0,
			invitacionesBorradas: 0,
			cuentasNuevas: 0,
			ultimoRaid: null,
			ultimoSpam: null,
		});
	}
	return stats.get(guildId);
}

// ==============================
//  UTILIDADES
// ==============================

function isExempt(member, cfg) {
	if (!member) return false;
	if (member.user.bot) return true;
	if (member.id === member.guild.ownerId) return true;
	if (
		member.permissions.has(PermissionFlagsBits.Administrator) ||
		member.permissions.has(PermissionFlagsBits.ManageMessages) ||
		member.permissions.has(PermissionFlagsBits.ManageGuild)
	) {
		return true;
	}
	return cfg.exemptRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

async function getLogChannel(guild, cfg) {
	if (!cfg.logChannelId) return null;
	try {
		const canal = await guild.channels.fetch(cfg.logChannelId);
		if (!canal || !canal.isTextBased()) return null;

		const yo = guild.members.me;
		if (yo && !canal.permissionsFor(yo)?.has(PermissionFlagsBits.SendMessages)) return null;

		return canal;
	} catch {
		return null;
	}
}

// ==============================
//  RESUMEN AGRUPADO DE INCIDENTES
//  En vez de un mensaje por cada usuario frenado (que en un raid llena el
//  canal), se juntan los de una misma oleada y se manda uno solo.
// ==============================

const GIF_ALERTA = path.join(__dirname, '..', 'assets', 'seguridad.gif');

const VENTANA_RESUMEN_MS = 8000; // se espera este rato de calma antes de enviar
const ESPERA_MAXIMA_MS = 30000; // ...pero nunca se retrasa más de esto

const resumenes = new Map(); // guildId -> { incidentes, notas, inicio, timer }

/**
 * Apunta un incidente para el próximo resumen. `incidentes` son usuarios a los
 * que se les impidió publicar (son los que se cuentan); `notas` es contexto,
 * como el inicio de un lockdown.
 */
function registrarIncidente(guild, cfg, incidente) {
	if (!cfg.logChannelId) return;

	let r = resumenes.get(guild.id);
	if (!r) {
		r = { incidentes: [], notas: [], inicio: Date.now(), timer: null };
		resumenes.set(guild.id, r);
	}

	if (incidente.nota) r.notas.push(incidente.nota);
	else r.incidentes.push(incidente);

	if (r.timer) clearTimeout(r.timer);

	// Si la oleada se alarga, se envía igualmente para no dejar a los mods a ciegas
	const restante = Math.max(0, ESPERA_MAXIMA_MS - (Date.now() - r.inicio));
	const espera = Math.min(VENTANA_RESUMEN_MS, restante);

	r.timer = setTimeout(() => {
		enviarResumen(guild, cfg).catch((err) =>
			console.error('[SEGURIDAD] No se pudo enviar el resumen:', err.message),
		);
	}, espera);
	r.timer.unref?.();
}

function fraseAnime(cuantos) {
	if (cuantos === 1) {
		return (
			'Una sombra intentó colarse entre los muros del servidor.\n' +
			'No llegó a pronunciar una sola palabra. **Sellado al instante.**'
		);
	}
	if (cuantos <= 4) {
		return (
			'Un pequeño escuadrón se acercó a las puertas con malas intenciones.\n' +
			'La barrera se alzó antes de que dijeran nada. **Ninguno pasó.**'
		);
	}
	return (
		'⚡ ¡Una horda cayó sobre el servidor! ⚡\n' +
		'El sello resistió y los invasores fueron repelidos uno a uno.\n' +
		'**La paz del reino sigue intacta.**'
	);
}

async function enviarResumen(guild, cfg) {
	const r = resumenes.get(guild.id);
	if (!r) return;

	resumenes.delete(guild.id);
	if (r.timer) clearTimeout(r.timer);
	if (!r.incidentes.length && !r.notas.length) return;

	const canal = await getLogChannel(guild, cfg);
	if (!canal) return;

	const detenidos = new Set(r.incidentes.map((i) => i.id)).size;

	const embed = new EmbedBuilder()
		.setColor(detenidos >= 5 ? 0xff0000 : detenidos > 0 ? 0xff8800 : 0x00cc66)
		.setTitle(detenidos > 0 ? '🛡️ ¡Intrusos repelidos!' : '🛡️ Aviso de seguridad')
		.setDescription(detenidos > 0 ? fraseAnime(detenidos) : r.notas.join('\n'))
		.setTimestamp();

	if (detenidos > 0) {
		embed.addFields({
			name: '🚫 Detenidos antes de publicar',
			value: `**${detenidos}** ${detenidos === 1 ? 'usuario' : 'usuarios'}`,
			inline: true,
		});

		// Detalle compacto para que los moderadores sepan a quién revisar
		const detalle = r.incidentes
			.slice(0, 10)
			.map((i) => `• ${i.tag} — ${i.motivo}${i.accion ? ` (${i.accion})` : ''}`)
			.join('\n');

		embed.addFields({
			name: '📋 Detalle',
			value:
				(detalle + (r.incidentes.length > 10 ? `\n…y ${r.incidentes.length - 10} más` : '')).slice(0, 1024) ||
				'—',
			inline: false,
		});

		if (r.notas.length) {
			embed.addFields({ name: 'ℹ️ Además', value: r.notas.join('\n').slice(0, 1024), inline: false });
		}
	}

	// El GIF se adjunta desde el repo: los enlaces del CDN de Discord caducan
	const archivos = [];
	if (cfg.alertImageUrl) {
		embed.setImage(cfg.alertImageUrl);
	} else if (fs.existsSync(GIF_ALERTA)) {
		archivos.push(new AttachmentBuilder(GIF_ALERTA, { name: 'seguridad.gif' }));
		embed.setImage('attachment://seguridad.gif');
	}

	try {
		await canal.send({ embeds: [embed], files: archivos });
	} catch (err) {
		console.error('[SEGURIDAD] No se pudo enviar el resumen:', err.message);
	}
}

/**
 * Aplica un castigo respetando la jerarquía de roles y los permisos del bot.
 * Devuelve la acción realmente aplicada, o null si no se pudo.
 */
async function punish(member, action, reason, timeoutMs) {
	const yo = member.guild.members.me;
	if (!yo) return null;

	try {
		if (action === 'ban') {
			if (!member.bannable) return null;
			await member.ban({ reason, deleteMessageSeconds: 60 * 60 });
			return 'baneado';
		}

		if (action === 'kick') {
			if (!member.kickable) return null;
			await member.kick(reason);
			return 'expulsado';
		}

		if (action === 'timeout') {
			if (!yo.permissions.has(PermissionFlagsBits.ModerateMembers)) return null;
			if (!member.moderatable) return null;
			await member.timeout(Math.min(timeoutMs, MAX_TIMEOUT_MS), reason);
			return 'silenciado';
		}
	} catch (err) {
		console.error(`[SEGURIDAD] Falló "${action}" sobre ${member.user.tag}:`, err.message);
		return null;
	}

	return null; // action === 'log'
}

// ==============================
//  LOCKDOWN (cierre temporal)
// ==============================

async function startLockdown(guild, cfg, motivo) {
	if (lockdowns.has(guild.id)) return false;

	const previousLevel = guild.verificationLevel;
	const until = Date.now() + cfg.lockdownMinutes * 60 * 1000;

	try {
		if (
			guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild) &&
			previousLevel < GuildVerificationLevel.High
		) {
			await guild.setVerificationLevel(GuildVerificationLevel.High, motivo);
		}
	} catch (err) {
		console.error('[SEGURIDAD] No se pudo subir el nivel de verificación:', err.message);
	}

	const timer = setTimeout(() => {
		endLockdown(guild, cfg, 'Fin automático del lockdown').catch(() => {});
	}, cfg.lockdownMinutes * 60 * 1000);

	lockdowns.set(guild.id, { until, previousLevel, timer });
	raidJoiners.set(guild.id, new Set());

	const s = getStats(guild.id);
	s.raids++;
	s.ultimoRaid = Date.now();

	registrarIncidente(guild, cfg, {
		nota:
			`🚨 **RAID DETECTADO — servidor en lockdown ${cfg.lockdownMinutes} min.** ${motivo} ` +
			`Verificación subida a ALTA; a quien entre se le aplica: ${cfg.raidAction}.`,
	});

	return true;
}

async function endLockdown(guild, cfg, motivo) {
	const estado = lockdowns.get(guild.id);
	if (!estado) return false;

	clearTimeout(estado.timer);
	lockdowns.delete(guild.id);
	const atrapados = raidJoiners.get(guild.id)?.size ?? 0;
	raidJoiners.delete(guild.id);
	joinLog.delete(guild.id);

	try {
		if (
			guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild) &&
			guild.verificationLevel !== estado.previousLevel
		) {
			await guild.setVerificationLevel(estado.previousLevel, motivo);
		}
	} catch (err) {
		console.error('[SEGURIDAD] No se pudo restaurar el nivel de verificación:', err.message);
	}

	registrarIncidente(guild, cfg, {
		nota: `✅ **Lockdown terminado.** ${motivo}. Cuentas afectadas: ${atrapados}. Verificación restaurada.`,
	});

	return true;
}

// ==============================
//  ENTRADAS: raid + cuentas nuevas
// ==============================

async function onGuildMemberAdd(member) {
	if (member.user.bot) return;

	const guild = member.guild;
	const cfg = getGuildConfig(guild.id);
	if (!cfg.enabled) return;

	const ahora = Date.now();

	// --- 1. Ventana deslizante de entradas ---
	const entradas = (joinLog.get(guild.id) ?? []).filter((t) => ahora - t < cfg.joinWindowMs);
	entradas.push(ahora);
	joinLog.set(guild.id, entradas);

	const enLockdown = lockdowns.has(guild.id);

	if (!enLockdown && entradas.length >= cfg.joinThreshold) {
		await startLockdown(
			guild,
			cfg,
			`${entradas.length} entradas en ${Math.round(cfg.joinWindowMs / 1000)} segundos.`,
		);
	}

	// --- 2. Durante el lockdown, castigar a quien entre ---
	if (lockdowns.has(guild.id)) {
		raidJoiners.get(guild.id)?.add(member.id);

		const aplicada = await punish(
			member,
			cfg.raidAction,
			'Anti-raid: entró durante un raid detectado',
			cfg.lockdownMinutes * 60 * 1000,
		);
		if (aplicada) getStats(guild.id).castigados++;

		registrarIncidente(guild, cfg, {
			id: member.id,
			tag: member.user.tag,
			motivo: 'entró durante el raid',
			accion: aplicada,
		});
		return;
	}

	// --- 3. Filtro de cuentas recién creadas ---
	if (cfg.minAccountAgeDays > 0) {
		const edadDias = (ahora - member.user.createdTimestamp) / (24 * 60 * 60 * 1000);

		if (edadDias < cfg.minAccountAgeDays) {
			const aplicada = await punish(
				member,
				cfg.newAccountAction,
				`Anti-raid: cuenta creada hace ${edadDias.toFixed(1)} días`,
				cfg.timeoutMinutes * 60 * 1000,
			);

			const s = getStats(guild.id);
			s.cuentasNuevas++;
			if (aplicada) s.castigados++;

			// No se cuenta como "detenido de publicar": solo entró
			registrarIncidente(guild, cfg, {
				nota:
					`👶 ${member.user.tag} entró con una cuenta de ${edadDias.toFixed(1)} días ` +
					`(mínimo ${cfg.minAccountAgeDays})${aplicada ? ` — ${aplicada}` : ''}`,
			});
		}
	}
}

// ==============================
//  MENSAJES: anti-spam
// ==============================

const INVITE_REGEX = /(?:discord(?:app)?\.com\/invite|discord\.(?:gg|io|me|li)|discord\.gg)\/[a-z0-9-_]+/i;

function normalizar(texto) {
	return texto.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function borrarMensajes(mensajes) {
	let borrados = 0;
	for (const msg of mensajes) {
		if (!msg.deletable) continue;
		const ok = await msg
			.delete()
			.then(() => true)
			.catch(() => false);
		if (ok) borrados++;
	}
	return borrados;
}

async function onMessageCreate(message) {
	if (!message.guild) return; // DMs fuera
	if (message.author.bot || message.webhookId) return;

	const cfg = getGuildConfig(message.guild.id);
	if (!cfg.enabled) return;

	// El miembro puede no estar cacheado
	let member = message.member;
	if (!member) {
		member = await message.guild.members.fetch(message.author.id).catch(() => null);
	}
	if (!member || isExempt(member, cfg)) return;

	const clave = `${message.guild.id}:${message.author.id}`;
	const ahora = Date.now();

	const registro = msgLog.get(clave) ?? { times: [], contents: [], messages: [] };
	registro.times = registro.times.filter((t) => ahora - t < cfg.msgWindowMs);
	registro.messages = registro.messages.filter((m) => ahora - m.createdTimestamp < cfg.msgWindowMs);
	registro.contents = registro.contents.filter((c) => ahora - c.t < cfg.msgWindowMs);

	registro.times.push(ahora);
	registro.messages.push(message);
	if (message.content) registro.contents.push({ t: ahora, texto: normalizar(message.content) });
	msgLog.set(clave, registro);

	let motivo = null;
	let aBorrar = [];

	// --- 0. @everyone / @here de un miembro demasiado reciente ---
	// El patrón clásico de estafa: una cuenta nueva pega @everyone con imágenes
	// y ni la ráfaga ni los repetidos lo pillan, porque es un único mensaje.
	// mentions.everyone vale para @everyone y @here, y solo es true si el ping
	// se llegó a enviar de verdad (es decir, si el autor tenía el permiso).
	if (cfg.everyoneMinDays > 0 && message.mentions.everyone) {
		const diasCuenta = (ahora - member.user.createdTimestamp) / 864e5;
		const diasServidor = member.joinedTimestamp
			? (ahora - member.joinedTimestamp) / 864e5
			: Infinity; // sin dato fiable, no lo usamos en contra

		if (diasCuenta < cfg.everyoneMinDays || diasServidor < cfg.everyoneMinDays) {
			const cual =
				diasCuenta < diasServidor
					? `su cuenta tiene ${diasCuenta.toFixed(1)} días`
					: `lleva ${diasServidor.toFixed(1)} días en el servidor`;

			motivo = `Usó @everyone/@here pero ${cual} (mínimo exigido: ${cfg.everyoneMinDays} días)`;
			aBorrar = [message];
		}
	}

	// --- 1. Menciones masivas ---
	const menciones =
		message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);
	if (!motivo && menciones > cfg.mentionLimit) {
		motivo = `Menciones masivas (${menciones} en un mensaje, límite ${cfg.mentionLimit})`;
		aBorrar = [message];
	}

	// --- 2. Ráfaga de mensajes ---
	if (!motivo && registro.times.length >= cfg.msgThreshold) {
		motivo = `Ráfaga de mensajes (${registro.times.length} en ${Math.round(cfg.msgWindowMs / 1000)}s)`;
		aBorrar = [...registro.messages];
	}

	// --- 3. Mensaje repetido ---
	if (!motivo && message.content) {
		const actual = normalizar(message.content);
		const repeticiones = registro.contents.filter((c) => c.texto === actual).length;
		if (repeticiones >= cfg.duplicateThreshold) {
			motivo = `Mensaje repetido ${repeticiones} veces`;
			aBorrar = [...registro.messages];
		}
	}

	// --- 4. Invitaciones a otros servidores ---
	if (!motivo && cfg.blockInvites && INVITE_REGEX.test(message.content ?? '')) {
		// Primera vez solo se borra y se avisa; no castigamos por un link suelto
		const quitados = await borrarMensajes([message]);
		const s = getStats(message.guild.id);
		s.invitacionesBorradas += quitados;
		s.mensajesBorrados += quitados;

		registrarIncidente(message.guild, cfg, {
			id: message.author.id,
			tag: message.author.tag,
			motivo: 'publicó una invitación a otro servidor',
			accion: 'mensaje borrado',
		});
		return;
	}

	if (!motivo) return;

	// --- Castigo ---
	msgLog.delete(clave);
	const borrados = await borrarMensajes(aBorrar);

	const aplicada = await punish(
		member,
		'timeout',
		`Anti-spam: ${motivo}`,
		cfg.timeoutMinutes * 60 * 1000,
	);

	const s = getStats(message.guild.id);
	s.mensajesBorrados += borrados;
	s.ultimoSpam = Date.now();
	if (aplicada) s.castigados++;

	registrarIncidente(message.guild, cfg, {
		id: message.author.id,
		tag: message.author.tag,
		motivo,
		accion: aplicada
			? `${aplicada} ${cfg.timeoutMinutes} min, ${borrados} msg borrados`
			: 'no se pudo castigar (permisos/jerarquía)',
	});
}

// ==============================
//  COMANDO *seguridad
// ==============================

function estadoEmbed(guild, cfg) {
	const enLockdown = lockdowns.get(guild.id);

	return new EmbedBuilder()
		.setColor(cfg.enabled ? 0x00cc66 : 0x888888)
		.setTitle('🛡️ Configuración de seguridad')
		.setDescription(
			enLockdown
				? `⚠️ **LOCKDOWN ACTIVO** hasta <t:${Math.floor(enLockdown.until / 1000)}:T>`
				: cfg.enabled
					? 'Protección activa.'
					: 'Protección **desactivada**.',
		)
		.addFields(
			{
				name: '📥 Anti-raid',
				value:
					`Umbral: **${cfg.joinThreshold}** entradas en **${Math.round(cfg.joinWindowMs / 1000)}s**\n` +
					`Lockdown: **${cfg.lockdownMinutes}** min\n` +
					`Acción: **${cfg.raidAction}**`,
				inline: true,
			},
			{
				name: '👶 Cuentas nuevas',
				value:
					`Edad mínima: **${cfg.minAccountAgeDays}** días\n` +
					`Acción: **${cfg.newAccountAction}**`,
				inline: true,
			},
			{
				name: '💬 Anti-spam',
				value:
					`Ráfaga: **${cfg.msgThreshold}** msgs en **${Math.round(cfg.msgWindowMs / 1000)}s**\n` +
					`Repetidos: **${cfg.duplicateThreshold}**\n` +
					`Menciones: **${cfg.mentionLimit}**\n` +
					`@everyone: **${cfg.everyoneMinDays > 0 ? `${cfg.everyoneMinDays} días de antigüedad` : 'libre'}**\n` +
					`Castigo: **${cfg.timeoutMinutes}** min\n` +
					`Invitaciones: **${cfg.blockInvites ? 'bloqueadas' : 'permitidas'}**`,
				inline: true,
			},
			{
				name: '📋 Canal de logs',
				value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : '*sin configurar*',
				inline: true,
			},
			{
				name: '✅ Roles exentos',
				value: cfg.exemptRoleIds.length
					? cfg.exemptRoleIds.map((r) => `<@&${r}>`).join(' ')
					: '*ninguno* (admins y mods siempre están exentos)',
				inline: true,
			},
		)
		.setFooter({ text: `${PREFIX}seguridad ayuda — para ver los subcomandos` });
}

// ==============================
//  AUDITORÍA (/seguridad)
// ==============================

const NIVELES_VERIFICACION = {
	[GuildVerificationLevel.None]: 'Ninguna ⚠️',
	[GuildVerificationLevel.Low]: 'Baja (email verificado)',
	[GuildVerificationLevel.Medium]: 'Media (5 min en Discord)',
	[GuildVerificationLevel.High]: 'Alta (10 min en el servidor)',
	[GuildVerificationLevel.VeryHigh]: 'Muy alta (teléfono verificado)',
};

function duracionLegible(ms) {
	const min = Math.floor(ms / 60000);
	const horas = Math.floor(min / 60);
	const dias = Math.floor(horas / 24);
	if (dias > 0) return `${dias}d ${horas % 24}h`;
	if (horas > 0) return `${horas}h ${min % 60}m`;
	return `${min}m`;
}

/**
 * Construye el informe de auditoría: permisos reales del bot, huecos de
 * configuración y actividad registrada desde que arrancó el proceso.
 */
async function buildAuditEmbed(guild) {
	const cfg = getGuildConfig(guild.id);
	const s = getStats(guild.id);
	const yo = guild.members.me;
	const problemas = [];

	// --- Permisos que el bot necesita según lo configurado ---
	const necesarios = [
		['ModerateMembers', 'Moderar miembros', 'silenciar (timeout) a quien spamea'],
		['ManageMessages', 'Gestionar mensajes', 'borrar los mensajes de spam'],
		['ManageGuild', 'Gestionar servidor', 'subir la verificación durante un raid'],
	];
	if (cfg.raidAction === 'kick' || cfg.newAccountAction === 'kick') {
		necesarios.push(['KickMembers', 'Expulsar miembros', 'la acción "kick" que configuraste']);
	}
	if (cfg.raidAction === 'ban') {
		necesarios.push(['BanMembers', 'Banear miembros', 'la acción "ban" que configuraste']);
	}

	const permisos = necesarios.map(([flag, nombre, para]) => {
		const tiene = yo?.permissions.has(PermissionFlagsBits[flag]) ?? false;
		if (!tiene) problemas.push(`Falta **${nombre}** — sin él no puedo ${para}.`);
		return `${tiene ? '✅' : '❌'} ${nombre}`;
	});

	// --- Canal de logs ---
	let estadoLog;
	if (!cfg.logChannelId) {
		estadoLog = '❌ sin configurar';
		problemas.push(`No hay canal de logs: no verás ningún reporte. Usa \`${PREFIX}seguridad log #canal\`.`);
	} else {
		const canal = await getLogChannel(guild, cfg);
		if (canal) {
			estadoLog = `✅ <#${cfg.logChannelId}>`;
		} else {
			estadoLog = `❌ <#${cfg.logChannelId}> inaccesible`;
			problemas.push('El canal de logs configurado no existe o no puedo escribir en él.');
		}
	}

	// --- Ajustes del propio servidor (no dependen del bot) ---
	if (guild.verificationLevel === GuildVerificationLevel.None) {
		problemas.push('El servidor no exige **ninguna verificación**: cualquier cuenta recién hecha puede entrar y escribir.');
	}
	if (guild.mfaLevel === 0) {
		problemas.push('El servidor no exige **2FA a los moderadores**. Si le roban la cuenta a un mod, se acabó.');
	}
	if (guild.roles?.everyone?.permissions.has(PermissionFlagsBits.MentionEveryone)) {
		problemas.push(
			'El rol **@everyone** puede mencionar a todos: cualquier miembro puede hacer `@everyone`. ' +
				`Ahora mismo lo freno para quien lleve menos de ${cfg.everyoneMinDays} días, pero lo suyo es ` +
				'quitar ese permiso en Ajustes del servidor → Roles.',
		);
	}
	if (!cfg.enabled) {
		problemas.push('⚠️ La protección está **desactivada** (`*seguridad on` para encenderla).');
	}

	const lockdown = lockdowns.get(guild.id);

	const embed = new EmbedBuilder()
		.setColor(problemas.length === 0 ? 0x00cc66 : problemas.length > 2 ? 0xff0000 : 0xffaa00)
		.setTitle('🔎 Auditoría de seguridad')
		.setDescription(
			lockdown
				? `🚨 **LOCKDOWN ACTIVO** hasta <t:${Math.floor(lockdown.until / 1000)}:T>`
				: cfg.enabled
					? '🛡️ Protección activa.'
					: '⚠️ Protección **desactivada**.',
		)
		.addFields(
			{ name: '🔑 Permisos del bot', value: permisos.join('\n'), inline: true },
			{
				name: '🏰 Ajustes del servidor',
				value:
					`Verificación: **${NIVELES_VERIFICACION[guild.verificationLevel] ?? guild.verificationLevel}**\n` +
					`Filtro de contenido: **${['desactivado ⚠️', 'solo sin rol', 'todos'][guild.explicitContentFilter] ?? '?'}**\n` +
					`2FA para mods: **${guild.mfaLevel === 0 ? 'no ⚠️' : 'sí'}**`,
				inline: true,
			},
			{ name: '📋 Canal de logs', value: estadoLog, inline: false },
			{
				name: `📊 Actividad (últimas ${duracionLegible(Date.now() - ARRANQUE)})`,
				value:
					`Raids detectados: **${s.raids}**${s.ultimoRaid ? ` — último <t:${Math.floor(s.ultimoRaid / 1000)}:R>` : ''}\n` +
					`Usuarios castigados: **${s.castigados}**\n` +
					`Mensajes borrados: **${s.mensajesBorrados}**\n` +
					`Invitaciones borradas: **${s.invitacionesBorradas}**\n` +
					`Cuentas nuevas marcadas: **${s.cuentasNuevas}**` +
					(s.ultimoSpam ? `\nÚltimo spam: <t:${Math.floor(s.ultimoSpam / 1000)}:R>` : ''),
				inline: false,
			},
			{
				name: '⚙️ Umbrales activos',
				value:
					`Raid: **${cfg.joinThreshold}** entradas / **${Math.round(cfg.joinWindowMs / 1000)}s** → ${cfg.raidAction}\n` +
					`Cuentas nuevas: **${cfg.minAccountAgeDays}d** → ${cfg.newAccountAction}\n` +
					`Spam: **${cfg.msgThreshold}** msgs / **${Math.round(cfg.msgWindowMs / 1000)}s**, ` +
					`repetidos **${cfg.duplicateThreshold}**, menciones **${cfg.mentionLimit}**\n` +
					`@everyone: **${cfg.everyoneMinDays > 0 ? `solo con ${cfg.everyoneMinDays}+ días` : 'libre para todos'}**\n` +
					`Castigo: **${cfg.timeoutMinutes}** min · Invitaciones: **${cfg.blockInvites ? 'bloqueadas' : 'permitidas'}**`,
				inline: false,
			},
		);

	embed.addFields({
		name: problemas.length ? `⚠️ Problemas detectados (${problemas.length})` : '✅ Sin problemas',
		value: problemas.length
			? problemas.map((p) => `• ${p}`).join('\n').slice(0, 1024)
			: 'Todo correctamente configurado.',
		inline: false,
	});

	return embed.setFooter({ text: `${PREFIX}seguridad ayuda — para cambiar los ajustes` }).setTimestamp();
}

const AYUDA = [
	'**Subcomandos de `*seguridad`**',
	'',
	'`on` / `off` — activa o desactiva toda la protección',
	'`log #canal` — canal donde reportar',
	'`raid <entradas> <segundos>` — umbral de avalancha de entradas',
	'`lockdown <minutos>` — cuánto dura el cierre',
	'`accion-raid <timeout|kick|ban|log>` — qué hacer con quien entre durante un raid',
	'`edad <dias>` — edad mínima de cuenta (0 para desactivar)',
	'`accion-nueva <timeout|kick|log>` — qué hacer con cuentas muy nuevas',
	'`spam <mensajes> <segundos>` — umbral de ráfaga',
	'`repetidos <n>` — cuántos mensajes iguales se toleran',
	'`menciones <n>` — menciones máximas por mensaje',
	'`everyone <dias>` — días de antigüedad para poder usar @everyone (0 lo permite a todos)',
	'`castigo <minutos>` — duración del timeout por spam',
	'`invitaciones on|off` — borrar links discord.gg',
	'`exento @rol` — añade o quita un rol de la lista de exentos',
	'`gif <url>` — cambia la imagen de los avisos (sin url usa la que trae el bot)',
	'`cerrar` / `abrir` — lockdown manual',
].join('\n');

async function onCommand(message) {
	const cfg = getGuildConfig(message.guild.id);
	const args = message.content.slice(PREFIX.length).trim().split(/\s+/).slice(1);
	const sub = (args.shift() ?? '').toLowerCase();
	const guardarYResponder = async (texto) => {
		saveConfig();
		await message.reply(texto);
	};

	const numero = (valor, min, max) => {
		const n = Number(valor);
		if (!Number.isFinite(n) || n < min || n > max) return null;
		return n;
	};

	switch (sub) {
		case '':
		case 'estado':
			return message.reply({ embeds: [estadoEmbed(message.guild, cfg)] });

		case 'ayuda':
			return message.reply(AYUDA);

		case 'on':
			cfg.enabled = true;
			return guardarYResponder('🛡️ Protección **activada**.');

		case 'off':
			cfg.enabled = false;
			return guardarYResponder('⚠️ Protección **desactivada**.');

		case 'log': {
			const canal = message.mentions.channels.first();
			if (!canal) return message.reply(`Uso: \`${PREFIX}seguridad log #canal\``);
			cfg.logChannelId = canal.id;
			return guardarYResponder(`📋 Los reportes irán a ${canal}.`);
		}

		case 'raid': {
			const entradas = numero(args[0], 2, 100);
			const segundos = numero(args[1], 1, 600);
			if (entradas === null || segundos === null) {
				return message.reply(`Uso: \`${PREFIX}seguridad raid 6 12\` (6 entradas en 12 segundos)`);
			}
			cfg.joinThreshold = entradas;
			cfg.joinWindowMs = segundos * 1000;
			return guardarYResponder(`📥 Raid = **${entradas}** entradas en **${segundos}s**.`);
		}

		case 'lockdown': {
			const minutos = numero(args[0], 1, 1440);
			if (minutos === null) return message.reply(`Uso: \`${PREFIX}seguridad lockdown 10\``);
			cfg.lockdownMinutes = minutos;
			return guardarYResponder(`🔒 El lockdown durará **${minutos}** min.`);
		}

		case 'accion-raid': {
			const accion = (args[0] ?? '').toLowerCase();
			if (!['timeout', 'kick', 'ban', 'log'].includes(accion)) {
				return message.reply(`Uso: \`${PREFIX}seguridad accion-raid timeout|kick|ban|log\``);
			}
			cfg.raidAction = accion;
			return guardarYResponder(`⚔️ Durante un raid: **${accion}**.`);
		}

		case 'edad': {
			const dias = numero(args[0], 0, 365);
			if (dias === null) return message.reply(`Uso: \`${PREFIX}seguridad edad 7\` (0 desactiva)`);
			cfg.minAccountAgeDays = dias;
			return guardarYResponder(
				dias === 0 ? '👶 Filtro de cuentas nuevas **desactivado**.' : `👶 Edad mínima: **${dias}** días.`,
			);
		}

		case 'accion-nueva': {
			const accion = (args[0] ?? '').toLowerCase();
			if (!['timeout', 'kick', 'log'].includes(accion)) {
				return message.reply(`Uso: \`${PREFIX}seguridad accion-nueva timeout|kick|log\``);
			}
			cfg.newAccountAction = accion;
			return guardarYResponder(`👶 Cuentas nuevas: **${accion}**.`);
		}

		case 'spam': {
			const mensajes = numero(args[0], 2, 50);
			const segundos = numero(args[1], 1, 300);
			if (mensajes === null || segundos === null) {
				return message.reply(`Uso: \`${PREFIX}seguridad spam 6 6\` (6 mensajes en 6 segundos)`);
			}
			cfg.msgThreshold = mensajes;
			cfg.msgWindowMs = segundos * 1000;
			return guardarYResponder(`💬 Spam = **${mensajes}** mensajes en **${segundos}s**.`);
		}

		case 'repetidos': {
			const n = numero(args[0], 2, 20);
			if (n === null) return message.reply(`Uso: \`${PREFIX}seguridad repetidos 3\``);
			cfg.duplicateThreshold = n;
			return guardarYResponder(`🔁 Se toleran **${n}** mensajes iguales.`);
		}

		case 'menciones': {
			const n = numero(args[0], 1, 50);
			if (n === null) return message.reply(`Uso: \`${PREFIX}seguridad menciones 6\``);
			cfg.mentionLimit = n;
			return guardarYResponder(`📣 Máximo **${n}** menciones por mensaje.`);
		}

		case 'everyone': {
			const dias = numero(args[0], 0, 365);
			if (dias === null) return message.reply(`Uso: \`${PREFIX}seguridad everyone 30\` (0 lo permite a todos)`);
			cfg.everyoneMinDays = dias;
			return guardarYResponder(
				dias === 0
					? '📣 Cualquiera puede usar **@everyone**.'
					: `📣 Solo quien lleve **${dias}** días podrá usar **@everyone**.`,
			);
		}

		case 'castigo': {
			const minutos = numero(args[0], 1, 40320);
			if (minutos === null) return message.reply(`Uso: \`${PREFIX}seguridad castigo 10\``);
			cfg.timeoutMinutes = minutos;
			return guardarYResponder(`⏱️ Timeout por spam: **${minutos}** min.`);
		}

		case 'invitaciones': {
			const valor = (args[0] ?? '').toLowerCase();
			if (!['on', 'off'].includes(valor)) {
				return message.reply(`Uso: \`${PREFIX}seguridad invitaciones on|off\``);
			}
			cfg.blockInvites = valor === 'on';
			return guardarYResponder(`🔗 Invitaciones: **${cfg.blockInvites ? 'bloqueadas' : 'permitidas'}**.`);
		}

		case 'exento': {
			const rol = message.mentions.roles.first();
			if (!rol) return message.reply(`Uso: \`${PREFIX}seguridad exento @rol\``);
			const i = cfg.exemptRoleIds.indexOf(rol.id);
			if (i === -1) {
				cfg.exemptRoleIds.push(rol.id);
				return guardarYResponder(`✅ ${rol} queda exento.`);
			}
			cfg.exemptRoleIds.splice(i, 1);
			return guardarYResponder(`❌ ${rol} ya no está exento.`);
		}

		case 'gif': {
			const url = args[0];
			if (!url) {
				cfg.alertImageUrl = null;
				return guardarYResponder('🖼️ Se usará el GIF incluido con el bot (`assets/seguridad.gif`).');
			}
			if (!/^https?:\/\//i.test(url)) {
				return message.reply(`Uso: \`${PREFIX}seguridad gif <url>\` (sin url vuelve al GIF por defecto)`);
			}
			cfg.alertImageUrl = url;
			return guardarYResponder('🖼️ Imagen de los avisos actualizada.');
		}

		case 'cerrar': {
			const ok = await startLockdown(message.guild, cfg, `Lockdown manual por ${message.author.tag}`);
			return message.reply(ok ? '🔒 Servidor en lockdown.' : 'Ya había un lockdown activo.');
		}

		case 'abrir': {
			const ok = await endLockdown(message.guild, cfg, `Lockdown levantado por ${message.author.tag}`);
			return message.reply(ok ? '🔓 Lockdown levantado.' : 'No había ningún lockdown activo.');
		}

		default:
			return message.reply(`Subcomando desconocido. Prueba \`${PREFIX}seguridad ayuda\`.`);
	}
}

// ==============================
//  LIMPIEZA PERIÓDICA DE MEMORIA
// ==============================

function limpiar() {
	const ahora = Date.now();

	for (const [clave, registro] of msgLog) {
		const ultimo = registro.times[registro.times.length - 1] ?? 0;
		if (ahora - ultimo > 60 * 1000) msgLog.delete(clave);
	}

	for (const [guildId, entradas] of joinLog) {
		if (!entradas.length || ahora - entradas[entradas.length - 1] > 5 * 60 * 1000) {
			joinLog.delete(guildId);
		}
	}
}

// ==============================
//  ENGANCHE
// ==============================

// Definición del slash command; index.js la mete en su array de comandos.
const slashCommand = new SlashCommandBuilder()
	.setName('seguridad')
	.setDescription('Protección anti-raid y anti-spam del servidor.')
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
	.setDMPermission(false)
	.addSubcommand((sub) =>
		sub
			.setName('auditoria')
			.setDescription('Informe: permisos del bot, agujeros de configuración y actividad registrada.')
			.addBooleanOption((o) =>
				o
					.setName('publico')
					.setDescription('Mostrar el informe a todo el canal (por defecto solo lo ves tú).'),
			),
	)
	.addSubcommand((sub) =>
		sub
			.setName('config')
			.setDescription('Cambia los ajustes. Rellena solo lo que quieras modificar.')
			.addIntegerOption((o) =>
				o
					.setName('dias_para_everyone')
					.setDescription('Días que hay que llevar para poder usar @everyone (0 = permitir a todos).')
					.setMinValue(0)
					.setMaxValue(365),
			)
			.addIntegerOption((o) =>
				o
					.setName('edad_minima_cuenta')
					.setDescription('Edad mínima de la cuenta al entrar, en días (0 = desactivar).')
					.setMinValue(0)
					.setMaxValue(365),
			)
			.addIntegerOption((o) =>
				o
					.setName('spam_mensajes')
					.setDescription('Cuántos mensajes seguidos cuentan como ráfaga.')
					.setMinValue(2)
					.setMaxValue(50),
			)
			.addIntegerOption((o) =>
				o
					.setName('spam_segundos')
					.setDescription('En cuántos segundos se miden esos mensajes.')
					.setMinValue(1)
					.setMaxValue(300),
			)
			.addIntegerOption((o) =>
				o
					.setName('mensajes_repetidos')
					.setDescription('Cuántos mensajes idénticos se toleran.')
					.setMinValue(2)
					.setMaxValue(20),
			)
			.addIntegerOption((o) =>
				o
					.setName('menciones_maximas')
					.setDescription('Menciones máximas permitidas en un solo mensaje.')
					.setMinValue(1)
					.setMaxValue(50),
			)
			.addIntegerOption((o) =>
				o
					.setName('castigo_minutos')
					.setDescription('Duración del timeout que se aplica al spammer.')
					.setMinValue(1)
					.setMaxValue(40320),
			)
			.addIntegerOption((o) =>
				o
					.setName('raid_entradas')
					.setDescription('Cuántas entradas seguidas se consideran un raid.')
					.setMinValue(2)
					.setMaxValue(100),
			)
			.addIntegerOption((o) =>
				o
					.setName('raid_segundos')
					.setDescription('En cuántos segundos se miden esas entradas.')
					.setMinValue(1)
					.setMaxValue(600),
			)
			.addChannelOption((o) =>
				o.setName('canal_log').setDescription('Canal donde reportar lo que se bloquee.'),
			)
			.addBooleanOption((o) =>
				o.setName('bloquear_invitaciones').setDescription('Borrar los links discord.gg.'),
			)
			.addBooleanOption((o) =>
				o.setName('activo').setDescription('Encender o apagar toda la protección.'),
			),
	);

// Opción del slash -> clave de configuración, con cómo mostrar el valor aplicado
const OPCIONES_CONFIG = [
	['dias_para_everyone', 'everyoneMinDays', (v) => (v === 0 ? '@everyone libre para todos' : `${v} días para poder usar @everyone`)],
	['edad_minima_cuenta', 'minAccountAgeDays', (v) => (v === 0 ? 'filtro de cuentas nuevas desactivado' : `cuentas de mínimo ${v} días`)],
	['spam_mensajes', 'msgThreshold', (v) => `ráfaga a partir de ${v} mensajes`],
	['spam_segundos', 'msgWindowMs', (v) => `ventana de ráfaga de ${v}s`, (v) => v * 1000],
	['mensajes_repetidos', 'duplicateThreshold', (v) => `${v} mensajes idénticos tolerados`],
	['menciones_maximas', 'mentionLimit', (v) => `máximo ${v} menciones por mensaje`],
	['castigo_minutos', 'timeoutMinutes', (v) => `timeout de ${v} min`],
	['raid_entradas', 'joinThreshold', (v) => `raid a partir de ${v} entradas`],
	['raid_segundos', 'joinWindowMs', (v) => `ventana de raid de ${v}s`, (v) => v * 1000],
	['bloquear_invitaciones', 'blockInvites', (v) => `invitaciones ${v ? 'bloqueadas' : 'permitidas'}`],
	['activo', 'enabled', (v) => `protección ${v ? 'activada' : 'desactivada'}`],
];

async function onInteraction(interaction) {
	if (!interaction.isChatInputCommand()) return;
	if (interaction.commandName !== 'seguridad') return;

	if (!interaction.guild) {
		return interaction.reply({ content: 'Este comando solo funciona dentro de un servidor.', ephemeral: true });
	}
	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
		return interaction.reply({ content: '❌ Necesitas el permiso **Gestionar servidor**.', ephemeral: true });
	}

	const sub = interaction.options.getSubcommand();

	// ---------- /seguridad config ----------
	if (sub === 'config') {
		const cfg = getGuildConfig(interaction.guild.id);
		const cambios = [];

		for (const [opcion, clave, describir, transformar] of OPCIONES_CONFIG) {
			const valor =
				typeof cfg[clave] === 'boolean'
					? interaction.options.getBoolean(opcion)
					: interaction.options.getInteger(opcion);
			if (valor === null || valor === undefined) continue;

			cfg[clave] = transformar ? transformar(valor) : valor;
			cambios.push(describir(valor));
		}

		const canal = interaction.options.getChannel('canal_log');
		if (canal) {
			if (!canal.isTextBased?.()) {
				return interaction.reply({ content: '❌ El canal de logs tiene que ser de texto.', ephemeral: true });
			}
			cfg.logChannelId = canal.id;
			cambios.push(`logs en ${canal}`);
		}

		if (!cambios.length) {
			return interaction.reply({
				content: `No indicaste ningún ajuste. Usa \`/seguridad auditoria\` para ver cómo está todo, o rellena alguna opción de \`/seguridad config\`.`,
				ephemeral: true,
			});
		}

		saveConfig();
		return interaction.reply({
			content: `✅ Actualizado:\n${cambios.map((c) => `• ${c}`).join('\n')}`,
			ephemeral: true,
		});
	}

	// ---------- /seguridad auditoria ----------
	const publico = interaction.options.getBoolean('publico') ?? false;
	await interaction.deferReply({ ephemeral: !publico });

	try {
		const embed = await buildAuditEmbed(interaction.guild);
		await interaction.editReply({ embeds: [embed] });
	} catch (err) {
		console.error('[SEGURIDAD] Error generando la auditoría:', err);
		await interaction.editReply('❌ No se pudo generar la auditoría. Revisa la consola del bot.');
	}
}

function init(client) {
	client.on(Events.InteractionCreate, (interaction) => {
		onInteraction(interaction).catch((err) =>
			console.error('[SEGURIDAD] Error en /seguridad:', err),
		);
	});

	client.on(Events.GuildMemberAdd, (member) => {
		onGuildMemberAdd(member).catch((err) =>
			console.error('[SEGURIDAD] Error en guildMemberAdd:', err),
		);
	});

	client.on(Events.MessageCreate, (message) => {
		// El comando de configuración se atiende antes que el anti-spam
		if (
			message.guild &&
			!message.author.bot &&
			message.content?.toLowerCase().startsWith(`${PREFIX}seguridad`)
		) {
			if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
				message.reply('❌ Necesitas el permiso **Gestionar servidor**.').catch(() => {});
				return;
			}
			onCommand(message).catch((err) => console.error('[SEGURIDAD] Error en *seguridad:', err));
			return;
		}

		onMessageCreate(message).catch((err) =>
			console.error('[SEGURIDAD] Error en messageCreate:', err),
		);
	});

	setInterval(limpiar, 60 * 1000).unref?.();

	console.log('[SEGURIDAD] Módulo anti-raid / anti-spam activo.');
}

module.exports = { init, slashCommand, buildAuditEmbed };
