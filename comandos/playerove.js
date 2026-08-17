/* =====================================================
   OVERWATCH 2 — TARJETA DE JUGADOR
   Datos de OverFast API (https://overfast-api.tekrop.fr)
   No necesita API key.
===================================================== */

const axios = require('axios');
// @napi-rs/canvas en vez de canvas: trae binarios precompilados, así que no
// hay que compilar nada en el host.
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');

const BASE = 'https://overfast-api.tekrop.fr';

const WIDTH = 1400;
const HEIGHT = 900;

const COLORS = {
	bgTop: '#0b1622',
	bgBottom: '#16283d',
	panel: 'rgba(15,23,42,0.92)',
	borde: '#2f4d70',
	texto: '#ffffff',
	suave: '#94a3b8',
	naranja: '#f99e1a', // el naranja de Overwatch
	verde: '#22c55e',
	rojo: '#ef4444',
};

// Colores de las divisiones competitivas
const DIVISIONES = {
	bronze: '#b06a3b',
	silver: '#a8b3bd',
	gold: '#e0a44b',
	platinum: '#7fa8b8',
	diamond: '#71a3d9',
	master: '#f1c40f',
	grandmaster: '#e0553f',
	champion: '#ff5edb',
	ultimate: '#ff2d55',
};

const ROLES = [
	['tank', 'TANQUE'],
	['damage', 'DAÑO'],
	['support', 'APOYO'],
];

const NOMBRE_DIVISION = {
	bronze: 'Bronce',
	silver: 'Plata',
	gold: 'Oro',
	platinum: 'Platino',
	diamond: 'Diamante',
	master: 'Maestro',
	grandmaster: 'Gran Maestro',
	champion: 'Campeón',
	ultimate: 'Definitivo',
};

/* =====================================================
   UTILIDADES
===================================================== */

/** El BattleTag va con guion en vez de almohadilla: Nombre#1234 -> Nombre-1234 */
function normalizarId(entrada) {
	return entrada.trim().replace(/#/g, '-');
}

function horas(segundos) {
	if (!segundos) return '0 h';
	const h = Math.floor(segundos / 3600);
	if (h >= 1) return `${h.toLocaleString('es')} h`;
	return `${Math.floor(segundos / 60)} min`;
}

function compacto(n) {
	if (n === null || n === undefined) return '—';
	if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
	if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
	return String(Math.round(n));
}

function colorWinrate(w) {
	if (w >= 55) return COLORS.verde;
	if (w >= 48) return COLORS.naranja;
	return COLORS.rojo;
}

async function imagenSegura(url) {
	if (!url) return null;
	try {
		return await loadImage(url);
	} catch {
		return null;
	}
}

/**
 * Pide a la API reintentando los fallos transitorios. OverFast devuelve 503
 * cuando Blizzard le está limitando y 504 si la página de Blizzard falla;
 * ambos suelen resolverse solos, y la respuesta trae Retry-After.
 */
async function pedirConReintentos(url, intentos = 3) {
	for (let i = 0; i < intentos; i++) {
		try {
			return await axios.get(url, { timeout: 15000 });
		} catch (err) {
			const status = err.response?.status;
			const transitorio = !status || status === 503 || status === 504 || status >= 500;

			if (!transitorio || i === intentos - 1) throw err;

			// La API dice cuánto esperar; se acota para no agotar la interacción
			const sugerido = Number(err.response?.headers?.['retry-after']);
			const espera = Math.min(Number.isFinite(sugerido) ? sugerido * 1000 : 0, 4000) || 1500 * (i + 1);

			console.warn(`[OVERWATCH] Intento ${i + 1}/${intentos} falló (${status ?? 'sin respuesta'}), reintentando en ${espera}ms`);
			await new Promise((r) => setTimeout(r, espera));
		}
	}
}

/* =====================================================
   DIBUJO
===================================================== */

function panel(ctx, x, y, w, h, color = COLORS.borde) {
	ctx.fillStyle = COLORS.panel;
	ctx.fillRect(x, y, w, h);
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.strokeRect(x, y, w, h);
}

function etiquetaValor(ctx, etiqueta, valor, x, y, colorValor = COLORS.texto) {
	ctx.fillStyle = COLORS.suave;
	ctx.font = '22px sans-serif';
	ctx.fillText(etiqueta, x, y);

	ctx.fillStyle = colorValor;
	ctx.font = 'bold 38px sans-serif';
	ctx.fillText(valor, x, y + 44);
}

/** Recuadro de rango de un rol. Devuelve la altura ocupada. */
function dibujarRol(ctx, nombre, rango, iconoRango, x, y, ancho) {
	const alto = 96;
	const color = rango ? (DIVISIONES[rango.division] ?? COLORS.suave) : COLORS.borde;

	panel(ctx, x, y, ancho, alto, color);

	ctx.fillStyle = color;
	ctx.font = 'bold 20px sans-serif';
	ctx.fillText(nombre, x + 16, y + 30);

	if (rango) {
		if (iconoRango) ctx.drawImage(iconoRango, x + ancho - 84, y + 14, 68, 68);

		ctx.fillStyle = COLORS.texto;
		ctx.font = 'bold 30px sans-serif';
		const division =
			NOMBRE_DIVISION[rango.division] ??
			rango.division.charAt(0).toUpperCase() + rango.division.slice(1);
		ctx.fillText(`${division} ${rango.tier}`, x + 16, y + 70);
	} else {
		ctx.fillStyle = COLORS.suave;
		ctx.font = '26px sans-serif';
		ctx.fillText('Sin clasificar', x + 16, y + 70);
	}

	return alto;
}

/* =====================================================
   COMANDO
===================================================== */

async function handlePlayerOverwatch(interaction) {
	const entrada = interaction.options.getString('battletag');
	const playerId = normalizarId(entrada);

	await interaction.deferReply();

	let perfil;
	let stats;

	try {
		const id = encodeURIComponent(playerId);
		const [resPerfil, resStats] = await Promise.all([
			pedirConReintentos(`${BASE}/players/${id}/summary`),
			pedirConReintentos(`${BASE}/players/${id}/stats/summary`),
		]);

		perfil = resPerfil.data;
		stats = resStats.data;
	} catch (err) {
		const status = err.response?.status;

		console.error('[OVERWATCH] Falló la consulta a OverFast API', {
			jugador: playerId,
			status: status ?? '(sin respuesta HTTP)',
			detalle: err.response?.data ?? err.message,
		});

		if (status === 404) {
			return interaction.followUp(
				`❌ No encontré a **${entrada}**. Recuerda incluir el número del BattleTag, por ejemplo \`Jugador#1234\`.`,
			);
		}
		if (status === 503 || status === 504) {
			return interaction.followUp(
				'🔧 Blizzard está limitando las consultas ahora mismo. No es cosa del bot; prueba otra vez en un minuto.',
			);
		}
		if (status === 429) {
			return interaction.followUp('⏳ Demasiadas consultas seguidas. Espera unos segundos.');
		}

		return interaction.followUp(
			`❌ No pude consultar los datos de Overwatch${status ? ` (HTTP ${status})` : ' (la API no respondió)'}.`,
		);
	}

	const general = stats?.general;
	if (!general) {
		return interaction.followUp(
			`⚠️ El perfil de **${entrada}** existe pero no tiene estadísticas visibles. ` +
				'En Overwatch, ve a Opciones → Social y pon el perfil en **público**.',
		);
	}

	/* ---------- Descarga de imágenes en paralelo ---------- */

	const competitivo = perfil?.competitive?.pc ?? perfil?.competitive?.console ?? {};

	const [avatar, namecard, ...iconos] = await Promise.all([
		imagenSegura(perfil?.avatar),
		imagenSegura(perfil?.namecard),
		...ROLES.map(([clave]) => imagenSegura(competitivo?.[clave]?.rank_icon)),
	]);

	/* ---------- Lienzo ---------- */

	const canvas = createCanvas(WIDTH, HEIGHT);
	const ctx = canvas.getContext('2d');

	const fondo = ctx.createLinearGradient(0, 0, 0, HEIGHT);
	fondo.addColorStop(0, COLORS.bgTop);
	fondo.addColorStop(1, COLORS.bgBottom);
	ctx.fillStyle = fondo;
	ctx.fillRect(0, 0, WIDTH, HEIGHT);

	// La namecard como banda superior, atenuada
	if (namecard) {
		ctx.save();
		ctx.globalAlpha = 0.35;
		ctx.drawImage(namecard, 0, 0, WIDTH, 200);
		ctx.restore();

		const velo = ctx.createLinearGradient(0, 0, 0, 200);
		velo.addColorStop(0, 'rgba(11,22,34,0.35)');
		velo.addColorStop(1, COLORS.bgTop);
		ctx.fillStyle = velo;
		ctx.fillRect(0, 0, WIDTH, 200);
	}

	// Franja naranja de Overwatch
	ctx.fillStyle = COLORS.naranja;
	ctx.fillRect(0, 0, WIDTH, 6);

	/* ---------- Cabecera: avatar, nombre, título ---------- */

	if (avatar) {
		ctx.save();
		ctx.beginPath();
		ctx.arc(100, 110, 62, 0, Math.PI * 2);
		ctx.closePath();
		ctx.clip();
		ctx.drawImage(avatar, 38, 48, 124, 124);
		ctx.restore();

		ctx.strokeStyle = COLORS.naranja;
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.arc(100, 110, 62, 0, Math.PI * 2);
		ctx.stroke();
	}

	ctx.fillStyle = COLORS.texto;
	ctx.font = 'bold 52px sans-serif';
	ctx.fillText(perfil?.username ?? entrada, 190, 104);

	if (perfil?.title) {
		ctx.fillStyle = COLORS.naranja;
		ctx.font = 'italic 28px sans-serif';
		ctx.fillText(perfil.title, 190, 146);
	}

	if (perfil?.endorsement?.level) {
		ctx.fillStyle = COLORS.suave;
		ctx.font = '24px sans-serif';
		ctx.fillText(`Recomendación ${perfil.endorsement.level}`, 190, 180);
	}

	ctx.fillStyle = COLORS.suave;
	ctx.font = '22px sans-serif';
	ctx.fillText('OVERWATCH 2', WIDTH - 200, 60);

	/* ---------- Columna izquierda: rangos por rol ---------- */

	let y = 240;
	ctx.fillStyle = COLORS.texto;
	ctx.font = 'bold 26px sans-serif';
	ctx.fillText('COMPETITIVO', 40, y);
	y += 24;

	ROLES.forEach(([clave, nombre], i) => {
		y += dibujarRol(ctx, nombre, competitivo?.[clave], iconos[i], 40, y, 380) + 16;
	});

	/* ---------- Columna derecha: estadísticas generales ---------- */

	const colX = 470;
	panel(ctx, colX, 264, WIDTH - colX - 40, 300);

	ctx.fillStyle = COLORS.naranja;
	ctx.font = 'bold 26px sans-serif';
	ctx.fillText('GENERAL', colX + 24, 300);

	const col = (i) => colX + 24 + i * 220;

	etiquetaValor(ctx, 'Partidas', compacto(general.games_played), col(0), 350);
	etiquetaValor(ctx, 'Victorias', compacto(general.games_won), col(1), 350, COLORS.verde);
	etiquetaValor(
		ctx,
		'Winrate',
		`${general.winrate ?? 0}%`,
		col(2),
		350,
		colorWinrate(general.winrate ?? 0),
	);
	etiquetaValor(ctx, 'KDA', String(general.kda ?? '—'), col(3), 350, COLORS.naranja);

	etiquetaValor(ctx, 'Tiempo jugado', horas(general.time_played), col(0), 460);
	etiquetaValor(ctx, 'Elim. / partida', String(general.average?.eliminations ?? '—'), col(1), 460);
	etiquetaValor(ctx, 'Daño / partida', compacto(general.average?.damage), col(2), 460);
	etiquetaValor(ctx, 'Curación / partida', compacto(general.average?.healing), col(3), 460);

	/* ---------- Héroes más jugados ---------- */

	const top = Object.entries(stats?.heroes ?? {})
		.filter(([, h]) => h?.time_played)
		.sort((a, b) => b[1].time_played - a[1].time_played)
		.slice(0, 4);

	if (top.length) {
		panel(ctx, colX, 596, WIDTH - colX - 40, 250);

		ctx.fillStyle = COLORS.naranja;
		ctx.font = 'bold 26px sans-serif';
		ctx.fillText('HÉROES MÁS JUGADOS', colX + 24, 632);

		const maxTiempo = top[0][1].time_played;

		top.forEach(([clave, h], i) => {
			const filaY = 672 + i * 44;
			const nombre = clave.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

			ctx.fillStyle = COLORS.texto;
			ctx.font = 'bold 24px sans-serif';
			ctx.fillText(nombre, colX + 24, filaY);

			// Barra proporcional al tiempo jugado
			const barraX = colX + 260;
			const barraAncho = 380;
			ctx.fillStyle = 'rgba(148,163,184,0.2)';
			ctx.fillRect(barraX, filaY - 20, barraAncho, 24);
			ctx.fillStyle = COLORS.naranja;
			ctx.fillRect(barraX, filaY - 20, barraAncho * (h.time_played / maxTiempo), 24);

			ctx.fillStyle = COLORS.suave;
			ctx.font = '22px sans-serif';
			ctx.fillText(horas(h.time_played), barraX + barraAncho + 16, filaY);

			ctx.fillStyle = colorWinrate(h.winrate ?? 0);
			ctx.fillText(`${h.winrate ?? 0}%`, barraX + barraAncho + 130, filaY);
		});
	}

	/* ---------- Pie ---------- */

	ctx.fillStyle = COLORS.suave;
	ctx.font = '18px sans-serif';
	ctx.fillText('Datos: OverFast API · overfast-api.tekrop.fr', 40, HEIGHT - 24);

	/* ---------- Envío ---------- */

	const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
		name: 'overwatch-profile.png',
	});

	return interaction.followUp({ files: [attachment] });
}

module.exports = { handlePlayerOverwatch };
