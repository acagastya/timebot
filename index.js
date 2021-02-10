const fs = require("fs");
const moment = require("moment-timezone");
const irc = require("irc");

const { channels, server, nick, maintainers } = require("./config");
const FILE = "./config.json";
let { alias } = JSON.parse(fs.readFileSync(FILE));

const ircClient = new irc.Client(server, nick, { channels });

ircClient.addListener("error", errorHandler);

ircClient.addListener("message", normalMsg);

ircClient.addListener("pm", pmHandler);

function handleKill(sender, msg) {
  if (msg != "KILL") return;
  if (!maintainer.includes(sender)) return;
  process.abort();
}

function pmHandler(sender, msg) {
  handleKill(sender, msg);
}

function normalMsg(sender, channel, msg) {
  if (msg.includes(`${nick} help`)) showHelp(channel, msg);
  else if (msg.includes(`${nick} ls `)) showList(channel, msg);
  else if (msg.includes(`${nick} add `)) addAlias(sender, channel, msg);
  else if (msg.includes(`${nick} rm `)) deleteAlias(sender, channel, msg);
  else if (msg.includes(`${nick} `)) sayTime(channel, msg);
}

function errorHandler(msg) {
  for (const maintainer of maintainers)
    ircClient.say(maintainer, `${nick} error: ${msg}`);
}

function showHelp(channel, msg) {
  ircClient.say(channel, `Use "${nick} help" to show help.`);
  ircClient.say(
    channel,
    `Use "${nick} ls <timezone>" to show a list of valid timezones.`
  );
  ircClient.say(
    channel,
    `Use "${nick} <timezone>" to display current time of <timezone>.`
  );
  ircClient.say(
    channel,
    `Use "${nick} add <alias>:<timezone>" for adding an <alias> for a <timezone>.`
  );
  ircClient.say(
    channel,
    `Use "${nick} rm <alias>" from removing an <alias> for a <timezone>.`
  );
}

function showList(channel, msg) {
  const reg = new RegExp(`${nick}:? ls (.*)`);
  const zone = msg.match(reg)[1];
  const allZones = moment.tz.names().map(el => el.replace(/_/g, " "));
  const res = allZones
    .filter(el => el.toLowerCase().includes(zone.toLowerCase()))
    .join(", ");
  ircClient.say(channel, res);
}

function sayTime(channel, msg) {
  const reg = new RegExp(`${nick}:? (.*)`);
  const zone = msg.match(reg)[1].replace(/ /g, "_");
  const machineReadableZone = alias[zone] || zone;
  const TZ = moment.tz.names().includes(machineReadableZone)
    ? machineReadableZone
    : "UTC";
  let time = moment.tz(TZ).format("HH:mm MMM DD z");
  ircClient.say(channel, time);
}

function addAlias(sender, channel, msg) {
  if (!maintainers.includes(sender)) {
    ircClient.say(channel, "Only maintainers allowed to add aliases.");
    return;
  }
  if (!msg.includes(":")) {
    ircClient.say(channel, "Wrong syntax.");
    showHelp(channel);
    return;
  }
  const reg = new RegExp(`${nick}:? add (.*)`);
  const [key, value] = msg.match(reg)[1].split(":");
  const machineReadableValue = value.replace(/ /g, "_");
  if (moment.tz.names().includes(machineReadableValue)) {
    alias[key] = machineReadableValue;
    fs.writeFileSync(
      FILE,
      JSON.stringify(Object.assign({}, { channels, alias }), null, 2) + "\n",
      err => {
        if (err) {
          ircClient.say(channel, `Error occurred: ${err}`);
          return;
        }
      }
    );
    alias = JSON.parse(fs.readFileSync(FILE)).alias;
    ircClient.say(channel, `Alias for ${key} has been added.`);
  }
}

function deleteAlias(sender, channel, msg) {
  if (!maintainers.includes(sender)) {
    ircClient.say(channel, "Only maintainers allowed to delete aliases.");
    return;
  }
  const reg = new RegExp(`${nick}:? rm (.*)`);
  const key = msg.match(reg)[1];
  delete alias[key];
  fs.writeFileSync(
    FILE,
    JSON.stringify(Object.assign({}, { channels, alias }), null, 2) + "\n",
    err => {
      if (err) {
        ircClient.say(channel, `Error occurred: ${err}`);
        return;
      }
    }
  );
  alias = JSON.parse(fs.readFileSync(FILE)).alias;
  ircClient.say(channel, `Alias for ${key} now does not exist.`);
}
