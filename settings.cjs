const { ActivityType, PresenceUpdateStatus } = require("discord.js");

module.exports = {
  timer: 61000, // Is in milliseconds. Default: 61000 ms = 1 minute & 1 second. Lower values may not work out well.
  cooldownTimer: 21600000, // Is in milliseconds. Default: 21600000 ms = 6 hours.
  language: 'english', // Default language 'english'. Other languages available in `i18n` folder.
  twitch: {
    clientID: 'vt6vvcdm7ik1v7ubdoj6qsg59slgrv', // Make a Twitch application at
    clientSecret: 'm7rtowl1f1lniig0sal9yi7j6rdh8p' // https://dev.twitch.tv/console/apps
  },
  discord: {
    token: 'ODA3MDA5NzA1NTk1MzcxNTYw.GnRDyr.42QHaTUaOwnNg63ORFAtedyKmnNhSWMaImx1XM', // https://discordapp.com/developers/applications/me/
    permissionForCommands: BigInt('0x0000000010000000'), // https://discordapp.com/developers/docs/topics/permissions
    message: '@everyone', // The default text on announcement, before the url and stream type. Can be changed with !message command. Default: '@everyone' = '@everyone LIVE! https://twitch.tv/stream'
    activity: {
      activities: [{
        name: 'TWITCH API',
        type: ActivityType.Watching, // .Listening, .Competing, .Playing, .Streaming, .Watching
      }],
      status: PresenceUpdateStatus.Online, // .Online, .Idle, .Invisible, .DoNotDisturb, .Offline
    }
  },
  log: true // Logs changes done to data.json into logs.txt.
}

/**
 * Example invite link for bot
 * https://discordapp.com/oauth2/authorize?client_id=<clientid from Discord>&scope=bot&permissions=3136
 */
