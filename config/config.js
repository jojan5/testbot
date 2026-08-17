require("dotenv").config();

module.exports = {
    /// Bot Discord
    TOKEN: process.env.TOKEN,  // your bot token (definir en .env)
    EMBED_COLOR: process.env.EMBED_COLOR || "#000001",
    DEV_ID: [], /// don't put only for development
    OWNER_ID: process.env.OWNER_ID || "331262808539004939"
}