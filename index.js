// node imports
const fs = require("fs");

// npm imports
const moment = require("moment-timezone");
const irc = require("irc");

// local imports
const { channels, server, nick, maintainers } = require("./config.js");

// constants
const FILE = "./alias.json";
let alias = JSON.parse(fs.readFileSync(FILE));

const ircClient = new irc.Client(server, nick, { channels });

// irc event-listeners
ircClient.addListener("error", errorHandler);

ircClient.addListener("message", normalMsg);

ircClient.addListener("pm", pmHandler);

// event listener functions
function errorHandler(msg) {
  for (const maintainer of maintainers)
    ircClient.say(maintainer, `${nick} error: ${msg}`);
}

function normalMsg(sender, channel, msg) {
  if (msg.includes(`${nick} help`)) showHelp(channel, msg);
  else if (msg.includes(`${nick} ls `)) showList(sender, msg);
  else if (msg.includes(`${nick} add `)) addAlias(sender, channel, msg);
  else if (msg.includes(`${nick} rm `)) deleteAlias(sender, channel, msg);
  else if (msg.includes(`${nick} link`)) giveLink(sender);
  else if (msg.includes(`${nick} `)) sayTime(channel, msg);
}

function pmHandler(sender, msg) {
  handleKill(sender, msg);
}

// helper functions
function addAlias(sender, channel, msg) {
  if (!maintainers.includes(sender)) {
    ircClient.say(channel, "Only maintainers allowed to add aliases.");
    return;
  }
  if (!msg.includes(":")) {
    ircClient.say(channel, "Wrong syntax, see <https://w.wiki/yes>");
    return;
  }
  const reg = new RegExp(`${nick}:? add (.*)`);
  let [key, value] = msg.match(reg)[1].split(":");
  key = key.toLowerCase();
  const machineReadableValue = value.replace(/ /g, "_");
  if (moment.tz.names().includes(machineReadableValue)) {
    alias[key] = machineReadableValue;
    fs.writeFileSync(
      FILE,
      JSON.stringify(Object.assign({}, alias), null, 2) + "\n",
      err => {
        if (err) {
          ircClient.say(channel, `Error occurred: ${err}`);
          delete alias[key];
          return;
        }
      }
    );
    alias = JSON.parse(fs.readFileSync(FILE));
    ircClient.say(channel, `Alias for ${key} has been added.`);
  }
}

function deleteAlias(sender, channel, msg) {
  if (!maintainers.includes(sender)) {
    ircClient.say(channel, "Only maintainers allowed to delete aliases.");
    return;
  }
  const reg = new RegExp(`${nick}:? rm (.*)`);
  const key = msg.match(reg)[1].toLowerCase();
  const val = alias[key];
  delete alias[key];
  fs.writeFileSync(
    FILE,
    JSON.stringify(Object.assign({}, alias), null, 2) + "\n",
    err => {
      if (err) {
        ircClient.say(channel, `Error occurred: ${err}`);
        if (val) alias[key] = val;
        return;
      }
    }
  );
  alias = JSON.parse(fs.readFileSync(FILE));
  ircClient.say(channel, `Alias for ${key} now does not exist.`);
}

function giveLink(sender) {
  ircClient.say(sender, "https://time-convertor.toolforge.org");
}

function handleKill(sender, msg) {
  if (msg != "KILL") return;
  if (!maintainers.includes(sender)) return;
  process.abort();
}

function sayTime(channel, msg) {
  const reg = new RegExp(`${nick}:? (.*)`);
  const zone = msg.match(reg)[1].replace(/ /g, "_");
  const machineReadableZone = alias[zone.toLowerCase()] || zone;
  const TZ = moment.tz.names().includes(machineReadableZone)
    ? machineReadableZone
    : "UTC";
  let time = moment.tz(TZ).format("HH:mm MMM DD z");
  ircClient.say(channel, time);
}

function showHelp(channel) {
  ircClient.say(channel, "Docs: <https://w.wiki/yes>");
}

function showList(sender, msg) {
  const reg = new RegExp(`${nick}:? ls (.*)`);
  const zone = msg.match(reg)[1].toLowerCase();
  const allZones = moment.tz.names().map(el => el.replace(/_/g, " "));
  const res = allZones
    .filter(el => el.toLowerCase().includes(zone))
    .join(", ");
  ircClient.say(sender, res);
}