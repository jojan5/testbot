// @napi-rs/canvas en vez de canvas: trae binarios precompilados, así que no
// hay que compilar nada en el host (canvas moría por falta de RAM al instalar).
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const sharp = require('sharp');

/* =====================================================
   CONFIGURACIÓN GLOBAL
===================================================== */

const BASE_DOMAIN = 'https://marvelrivalsapi.com';
const BASE_ASSETS = 'https://marvelrivalsapi.com/rivals';

const WIDTH = 1200;
const HEIGHT = 750;

const COLORS = {
    bgTop: '#0f172a',
    bgBottom: '#1e293b',
    panel: '#1f2a3a',
    panelSoft: '#22324a',
    text: '#ffffff',
    subtext: '#9ca3af',
    win: '#22c55e',
    loss: '#ef4444',
    border: '#2d3c55'
};

/* =====================================================
   UTILIDADES
===================================================== */

function buildAsset(path) {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/rivals')) return BASE_DOMAIN + path;
    return BASE_ASSETS + path;
}

/**
 * Consulta la API reintentando los fallos transitorios (5xx o caída de red).
 * Un 502 puntual del proveedor no debería tumbar el comando.
 */
async function pedirConReintentos(url, headers, intentos = 3) {
    for (let i = 0; i < intentos; i++) {
        try {
            return await axios.get(url, { headers, timeout: 10000 });
        } catch (err) {
            const status = err.response?.status;
            const transitorio = !status || status >= 500;

            if (!transitorio || i === intentos - 1) throw err;

            console.warn(`[MARVEL] Intento ${i + 1}/${intentos} falló (${status ?? 'sin respuesta'}), reintentando...`);
            await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        }
    }
}

async function safeImage(path) {
    try {
        const url = buildAsset(path);
        if (!url) return null;

        const res = await axios.get(url, { responseType: 'arraybuffer' });
        const png = await sharp(res.data).png().toBuffer();
        return await loadImage(png);

    } catch {
        return null;
    }
}

/* =====================================================
   MAIN COMMAND
===================================================== */

async function handlePlayerMarvel(interaction) {

    const username = interaction.options.getString('username');
    const API_KEY = process.env.MARVEL_RIVALS_API_KEY;

    if (!API_KEY)
        return interaction.reply({ content: '❌ API key no configurada.', ephemeral: true });

    await interaction.deferReply();

    let data;

    try {
        const response = await pedirConReintentos(
            `https://marvelrivalsapi.com/api/v1/player/${encodeURIComponent(username)}`,
            { 'x-api-key': API_KEY }
        );

        data = response.data;

        if (!data || data.isPrivate)
            return interaction.followUp('⚠️ Perfil privado o no disponible.');

    } catch (err) {
        const status = err.response?.status;

        console.error('[MARVEL] Falló la consulta a marvelrivalsapi.com', {
            usuario: username,
            status: status ?? '(sin respuesta HTTP)',
            detalle: err.response?.data ?? err.message,
        });

        const porStatus = {
            401: '❌ La API key de Marvel Rivals no es válida o ha caducado.',
            403: '❌ La API key de Marvel Rivals no tiene acceso a este recurso.',
            404: `❌ No encontré al jugador **${username}**. Revisa que el nombre esté bien escrito.`,
            429: '⏳ La API de Marvel Rivals está limitando las peticiones. Prueba en un minuto.',
        };

        // 5xx = el problema está en el servidor de marvelrivalsapi.com, no aquí
        if (status >= 500) {
            return interaction.followUp(
                `🔧 La API de Marvel Rivals está caída ahora mismo (HTTP ${status}). ` +
                    'No es un problema del bot; inténtalo de nuevo en unos minutos.',
            );
        }

        return interaction.followUp(
            porStatus[status] ??
                `❌ No pude consultar la API de Marvel Rivals${status ? ` (HTTP ${status})` : ' (no respondió)'}.`,
        );
    }

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    /* =====================================================
       BACKGROUND
    ===================================================== */

    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, COLORS.bgTop);
    gradient.addColorStop(1, COLORS.bgBottom);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    /* =====================================================
       HEADER
    ===================================================== */

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(data.name ?? username, 220, 90);

    ctx.fillStyle = COLORS.subtext;
    ctx.font = '22px sans-serif';
    ctx.fillText(`UID: ${data.uid}`, 220, 120);
    ctx.fillText(`Level: ${data.player?.level ?? 'N/A'}`, 220, 150);

    const playerIcon = await safeImage(data.player?.icon?.player_icon);
    if (playerIcon) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(120, 120, 80, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(playerIcon, 40, 40, 160, 160);
        ctx.restore();
    }

    const rankIcon = await safeImage(data.player?.rank?.image);
    if (rankIcon) {
        ctx.drawImage(rankIcon, WIDTH - 180, 50, 120, 120);
    }

    /* =====================================================
       TOP PANELS (STATS & GAME INFO)
    ===================================================== */

    const panelY = 210;

    // ===== LEFT PANEL (STATS) =====

    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(60, panelY, 500, 150);

    const ranked = data.overall_stats?.ranked ?? {};
    const matches = ranked.total_matches ?? 0;
    const wins = ranked.total_wins ?? 0;
    const losses = matches - wins;

    const kills = ranked.total_kills ?? 0;
    const deaths = ranked.total_deaths ?? 1;
    const kd = (kills / Math.max(deaths, 1)).toFixed(2);

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 24px sans-serif';

    ctx.fillText(`Partidas: ${matches}`, 100, panelY + 60);
    ctx.fillText(`Victorias: ${wins}`, 100, panelY + 95);
    ctx.fillText(`Derrotas: ${losses}`, 300, panelY + 60);
    ctx.fillText(`K/D: ${kd}`, 300, panelY + 95);

    // ===== RIGHT PANEL (GAME INFO) =====

    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(640, panelY, 500, 150);

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('Game Info', 670, panelY + 45);

    const season =
        data.match_history?.[0]?.season ?? 'N/A';

    const lastUpdate =
        data.updates?.info_update_time ?? 'N/A';

    ctx.font = '20px sans-serif';
    ctx.fillStyle = COLORS.subtext;
    ctx.fillText(`Season: ${season}`, 670, panelY + 80);
    ctx.fillText(`Profile Updated:`, 670, panelY + 110);
    ctx.fillText(`${lastUpdate}`, 670, panelY + 130);

    /* =====================================================
       LOWER SECTION
    ===================================================== */

    const baseY = 420;

    // ========= LEFT COLUMN (MATCHES) =========

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Últimas partidas', 100, baseY);

    const matchesList = (data.match_history ?? []).slice(0, 3);

    for (let i = 0; i < matchesList.length; i++) {

        const match = matchesList[i];
        const y = baseY + 60 + (i * 100);
        const isWin = match.player_performance?.is_win?.is_win ?? false;

        ctx.fillStyle = COLORS.panelSoft;
        ctx.fillRect(80, y - 40, 500, 80);

        ctx.strokeStyle = isWin ? COLORS.win : COLORS.loss;
        ctx.lineWidth = 3;
        ctx.strokeRect(80, y - 40, 500, 80);

        ctx.fillStyle = isWin ? COLORS.win : COLORS.loss;
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(isWin ? 'WIN' : 'LOSS', 100, y);

        const mapImg = await safeImage(match.map_thumbnail);
        if (mapImg)
            ctx.drawImage(mapImg, 170, y - 30, 130, 60);

        ctx.fillStyle = COLORS.subtext;
        ctx.font = '20px sans-serif';
        ctx.fillText(`${Math.floor(match.duration / 60)}m`, 320, y);
    }

    // ========= RIGHT COLUMN (TOP HEROES) =========

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Top Heroes', 700, baseY);

    const heroes = (data.heroes_ranked ?? [])
        .sort((a, b) => b.matches - a.matches)
        .slice(0, 3);

    for (let i = 0; i < heroes.length; i++) {

        const hero = heroes[i];
        const y = baseY + 60 + (i * 100);

        ctx.fillStyle = COLORS.panelSoft;
        ctx.fillRect(680, y - 40, 500, 80);

        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(680, y - 40, 500, 80);

        const heroImg = await safeImage(hero.hero_thumbnail);
        if (heroImg)
            ctx.drawImage(heroImg, 700, y - 30, 70, 70);

        ctx.fillStyle = COLORS.text;
        ctx.font = '20px sans-serif';
        ctx.fillText(
            `${hero.hero_name} | ${hero.matches} partidas`,
            790,
            y
        );
    }

    /* =====================================================
       EXPORT
    ===================================================== */

    const buffer = canvas.toBuffer('image/png');

    const attachment = new AttachmentBuilder(buffer, {
        name: 'marvel-profile.png'
    });

    await interaction.followUp({ files: [attachment] });
}

module.exports = {
    handlePlayerMarvel
};