/* =====================================================
   IMPORTACIONES
===================================================== */

const axios = require("axios");
// @napi-rs/canvas en vez de canvas: trae binarios precompilados, así que no
// hay que compilar nada en el host (canvas moría por falta de RAM al instalar).
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { AttachmentBuilder } = require("discord.js");


/* =====================================================
   CONFIGURACIÓN
===================================================== */

const WIDTH = 2200;
const HEIGHT = 1800;


/* =====================================================
   FUNCIONES AUXILIARES
===================================================== */

function getDynamicColor(kd) {
    if (kd >= 4) return "#ff2d2d";
    if (kd >= 3) return "#ffd700";
    if (kd >= 2) return "#ff4d4d";
    if (kd >= 1) return "#3b82f6";
    return "#9ca3af";
}

function getRankLetter(kd) {
    if (kd >= 4) return "SSS";
    if (kd >= 3) return "S";
    if (kd >= 2) return "A";
    if (kd >= 1) return "B";
    return "C";
}

async function safeLoadImage(url) {
    try { return await loadImage(url); }
    catch { return null; }
}


/* =====================================================
   MINI PANEL (CENTRADO)
===================================================== */

function drawMiniPanel(ctx, title, stats, x, y, width, height, color) {

    ctx.fillStyle = "rgba(15,23,42,0.95)";
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.strokeRect(x, y, width, height);
    ctx.shadowBlur = 0;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, 50);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(title, x + 20, y + 35);

    ctx.font = "26px sans-serif";
    ctx.fillText(`Wins: ${stats?.wins ?? 0}`, x + 40, y + 110);
    ctx.fillText(`Matches: ${stats?.matches ?? 0}`, x + 40, y + 160);
    ctx.fillText(`Kills: ${stats?.kills ?? 0}`, x + 40, y + 210);
    ctx.fillText(`Deaths: ${stats?.deaths ?? 0}`, x + 40, y + 260);
    ctx.fillText(`K/D: ${stats?.kd ?? 0}`, x + 40, y + 310);
}


/* =====================================================
   MAIN HANDLER
===================================================== */

async function handlePlayerFortnite(interaction) {

    const username = interaction.options.getString("username");

    const API_KEY =
        process.env.FORTNITE_KEY ||
        process.env.FORNITE_KEY;

    if (!API_KEY)
        return interaction.reply({
            content: "❌ API key no configurada.",
            ephemeral: true
        });

    await interaction.deferReply();


    try {

        const response = await axios.get(
            "https://fortnite-api.com/v2/stats/br/v2",
            {
                headers: { Authorization: API_KEY },
                params: {
                    name: username,
                    timeWindow: "lifetime-Tiempo de vida",
                    image: "all"
                }
            }
        );

        const data = response.data?.data;
        if (!data)
            return interaction.followUp("⚠️ Perfil no encontrado.");

        const lifetime = data.stats.all.overall;
        const season = data.stats.all.solo;

        const kd = lifetime.kd ?? 0;

        const dynamicColor = getDynamicColor(kd);
        const rankLetter = getRankLetter(kd);

        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext("2d");


        /* ==========================
           FONDO
        ========================== */

        const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        gradient.addColorStop(0, "#0f172a");
        gradient.addColorStop(1, "#1e40af");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);


        /* ==========================
           MARCO EXTERIOR
        ========================== */

        ctx.strokeStyle = dynamicColor;
        ctx.lineWidth = 8;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 30;
        ctx.strokeRect(60, 60, WIDTH - 120, HEIGHT - 120);
        ctx.shadowBlur = 0;


        /* ==========================
           NOMBRE (CENTRADO REAL)
        ========================== */

        ctx.font = "bold 120px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 60;

        const nameWidth = ctx.measureText(data.account.name).width;
        ctx.fillText(data.account.name, (WIDTH - nameWidth) / 2, 200);
        ctx.shadowBlur = 0;


        /* ==========================
           KDA RANK (CENTRADO)
        ========================== */

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 50px sans-serif";

        const rankTitle = "KDA RANK";
        const rankTitleWidth = ctx.measureText(rankTitle).width;
        ctx.fillText(rankTitle, (WIDTH - rankTitleWidth) / 2, 280);

        ctx.font = "bold 200px sans-serif";
        ctx.fillStyle = dynamicColor;
        ctx.shadowColor = dynamicColor;
        ctx.shadowBlur = 50;

        const rankWidth = ctx.measureText(rankLetter).width;
        ctx.fillText(rankLetter, (WIDTH - rankWidth) / 2, 470);
        ctx.shadowBlur = 0;


        /* ==========================
           MINI PANELES CENTRADOS
        ========================== */

        const panelWidth = 650;
        const panelHeight = 380;
        const spacing = 150;

        const totalWidth = panelWidth * 2 + spacing;

        const startX = (WIDTH - totalWidth) / 2;

        drawMiniPanel(
            ctx,
            "LIFETIME",
            lifetime,
            startX,
            550,
            panelWidth,
            panelHeight,
            "#22c55e"
        );

        drawMiniPanel(
            ctx,
            "CURRENT SEASON",
            season,
            startX + panelWidth + spacing,
            550,
            panelWidth,
            panelHeight,
            "#f97316"
        );


        /* ==========================
           IMAGEN OFICIAL CENTRADA
        ========================== */

        if (data.image) {

            const image = await safeLoadImage(data.image);

            if (image) {

                const imgWidth = 1400;
                const imgX = (WIDTH - imgWidth) / 2;

                ctx.drawImage(image, imgX, 1000, imgWidth, 450);//320
            }
        }


        /* ==========================
           ENVIAR IMAGEN
        ========================== */

        const attachment = new AttachmentBuilder(
            canvas.toBuffer("image/png"),
            { name: "fortnite-profile-centered.png" }
        );

        await interaction.followUp({ files: [attachment] });

    } catch (err) {

        console.error(err.response?.data || err.message);
        return interaction.followUp("❌ Error obteniendo estadísticas.");
    }
}

module.exports = { handlePlayerFortnite };