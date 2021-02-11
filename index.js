// node imports
const child_process = require("child_process");
const { readFileSync, writeFileSync } = require("fs");
const { promisify } = require("util");
const exec = promisify(child_process.exec);

// npm imports
const irc = require("irc");

// local imports
const { channels, maintainers, nick, server } = require("./config.js");
const zones = require("./zones.js");

// constants
const FILE = "./alias.json";
let alias = JSON.parse(readFileSync(FILE));

const ircClient = new irc.Client(server, nick, {
  channels,
  userName: "swtimebot",
  realName: "swtimebot",
  floodProtection: true,
  floodProtectionDelay: 1000,
});

// ircClient event listeners
ircClient.addListener("error", errorHandler);
ircClient.addListener("message", normalMsg);
ircClient.addListener("pm", pmHandler);

// event-listener functions
function errorHandler(msg = "") {
  for (const maintainer of maintainers)
    ircClient.say(maintainer, `${nick} error: ${msg}`);
}

async function normalMsg(sender, channel, msg) {
  if (msg.includes(`${nick} help`)) showHelp(channel);
  else if (msg.startsWith(`${nick} ls `)) showList(sender, msg);
  else if (msg.startsWith(`${nick} add `)) addAlias(sender, channel, msg);
  else if (msg.startsWith(`${nick} rm `)) deleteAlias(sender, channel, msg);
  else if (msg.startsWith(`${nick} link`)) giveLink(sender);
  else if (msg.startsWith(`${nick} `)) await sayTime(channel, msg);
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
  if (zones.includes(machineReadableValue)) {
    alias[key] = machineReadableValue;
    writeFileSync(
      FILE,
      JSON.stringify(Object.assign({}, alias), null, 2) + "\n",
      (err) => {
        if (err) {
          delete alias[key];
          ircClient.say(channel, `Error occurred: ${err}`);
          return;
        }
      }
    );
    alias = JSON.parse(readFileSync(FILE));
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
  writeFileSync(
    FILE,
    JSON.stringify(Object.assign({}, alias), null, 2) + "\n",
    (err) => {
      if (err) {
        ircClient.say(channel, `Error occurred: ${err}`);
        if (val) alias[key] = val;
        return;
      }
    }
  );
  alias = JSON.parse(readFileSync(FILE));
  ircClient.say(channel, `Alias for ${key} now does not exist.`);
}

function formatOutput(str) {
  return str.slice(0, -1);
}

async function getTime(tz) {
  try {
    const { stderr, stdout } = await exec(`TZ=${tz} date`);
    if (stderr) throw new Error(stderr);
    const output = formatOutput(stdout);
    return output;
  } catch (err) {
    console.log(err);
  }
}

function giveLink(sender) {
  ircClient.say(sender, "https://time-convertor.toolforge.org");
}

function handleKill(sender, msg) {
  if (msg != "KILL") return;
  if (!maintainers.includes(sender)) return;
  process.abort();
}

async function sayTime(channel, msg) {
  const reg = new RegExp(`${nick}:? (.*)`);
  const zone = msg.match(reg)[1].replace(/ /g, "_");
  const machineReadableZone = alias[zone.toLowerCase()] || zone;
  const TZ = zones.indexOf(machineReadableZone) >= 0 ? machineReadableZone : "UTC";
  const time = await getTime(TZ);
  if (time) ircClient.say(channel, time);
}

function showHelp(channel) {
  ircClient.say(channel, `Docs: <https://w.wiki/yes>`);
}

function showList(sender, msg) {
  const reg = new RegExp(`${nick}:? ls (.*)`);
  const zone = msg.match(reg)[1].toLowerCase();
  const allZones = zones.map((el) => el.replace(/_/g, " "));
  const res = allZones
    .filter((el) => el.toLowerCase().includes(zone))
    .join(", ");
  ircClient.say(sender, res);
}
