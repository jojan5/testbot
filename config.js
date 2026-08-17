let giveawayChannelId = null;

function setChannel(id) {
  giveawayChannelId = id;
}

function getChannel() {
  return giveawayChannelId;
}

module.exports = { setChannel, getChannel };