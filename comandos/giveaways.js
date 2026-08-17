const axios = require("axios");
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const GIVE_FILE = path.join(__dirname, "../give.json");
const API_URL = "https://www.gamerpower.com/api/giveaways";

/* =======================================================
   FETCH API CON RETRY
======================================================= */

async function fetchGiveaways() {
    try {
        console.log("🌐 Consultando API GamerPower...");

        const res = await axios.get(API_URL, { timeout: 15000 });

        console.log("✅ API respondió correctamente");
        return res.data;

    } catch (err) {

        console.log("⚠ Primer intento falló, reintentando...");

        try {
            const retry = await axios.get(API_URL, { timeout: 15000 });

            console.log("✅ API respondió en segundo intento");
            return retry.data;

        } catch (finalErr) {

            console.log("❌ ERROR DEFINITIVO API:", finalErr.code || finalErr.message);
            return null;
        }
    }
}

/* =======================================================
   DB SEGURA
======================================================= */

function loadDatabase() {
    try {

        if (!fs.existsSync(GIVE_FILE)) {
            fs.writeFileSync(GIVE_FILE, JSON.stringify({}, null, 2));
            return {};
        }

        const raw = fs.readFileSync(GIVE_FILE, "utf8");

        if (!raw || raw.trim() === "") return {};

        const parsed = JSON.parse(raw);

        if (typeof parsed !== "object" || Array.isArray(parsed)) {
            console.log("⚠ give.json inválido, reiniciando");
            return {};
        }

        return parsed;

    } catch (err) {
        console.log("⚠ Error leyendo give.json:", err.message);
        return {};
    }
}

function saveDatabase(data) {
    try {
        fs.writeFileSync(GIVE_FILE, JSON.stringify(data, null, 2));
        console.log("💾 give.json guardado");
    } catch (err) {
        console.log("❌ Error guardando give.json:", err.message);
    }
}

/* =======================================================
   MAIN MULTI-SERVIDOR
======================================================= */

async function postFreeGames(client, guildId, channelId) {

    console.log("\n================ GIVEAWAY CHECK ================");
    console.log("Guild:", guildId);
    console.log("Canal:", channelId);

    if (!channelId) {
        console.log("❌ Canal no configurado");
        return;
    }

    const data = await fetchGiveaways();
    if (!data) return;

    console.log("📦 Total recibidos:", data.length);

    const juegos = data.filter(g =>
        g.type === "Game" &&
        g.status === "Active"
    );

    console.log("🎮 Juegos activos:", juegos.length);

    if (!juegos.length) return;

    let channel;
    try {
        channel = await client.channels.fetch(channelId);
    } catch {
        console.log("❌ No se pudo obtener canal");
        return;
    }

    if (!channel) return;

    const db = loadDatabase();

    if (!db[guildId]) {
        db[guildId] = { published: [] };
        console.log("📂 Creando registro nuevo para guild");
    }

    let sentIds = db[guildId].published;

    console.log("📂 IDs guardados:", sentIds.length);

    let publicados = 0;

    for (const juego of juegos) {

        if (sentIds.includes(juego.id)) {
            continue;
        }

        const precioTexto =
            juego.worth && juego.worth !== "N/A"
                ? `~~${juego.worth}~~ ➜ **🆓 GRATIS**`
                : "**🆓 GRATIS**";

        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${juego.title}`)
            .setURL(juego.open_giveaway_url)
            .setDescription(
                juego.description.length > 400
                    ? juego.description.substring(0, 400) + "..."
                    : juego.description
            )
            .setImage(juego.image)
            .setColor("#00ff88")
            .addFields(
                { name: "💰 Precio", value: precioTexto, inline: true },
                { name: "🖥 Plataforma", value: juego.platforms, inline: true },
                { name: "⏳ Expira", value: juego.end_date || "No especificado", inline: true }
            )
            .setFooter({ text: "Juegos gratis vía GamerPower API" });

        try {
            await channel.send({ embeds: [embed] });
            console.log("✅ Publicado:", juego.id);
        } catch (err) {
            console.log("❌ Error enviando embed:", err.message);
            continue;
        }

        sentIds.push(juego.id);
        publicados++;

        if (sentIds.length > 100) {
            sentIds.shift();
        }
    }

    db[guildId].published = sentIds;
    saveDatabase(db);

    console.log("📊 Publicados en este guild:", publicados);
    console.log("=================================================\n");
}

module.exports = { postFreeGames };