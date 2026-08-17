const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "giveChannel.json");

function getAllData() {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath));
}

function setChannel(guildId, channelId) {

    const data = getAllData();

    data[guildId] = channelId;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    console.log(`💾 Canal guardado para guild ${guildId}: ${channelId}`);
}

function getChannel(guildId) {

    const data = getAllData();

    return data[guildId] || null;
}

module.exports = { setChannel, getChannel };