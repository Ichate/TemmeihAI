import { CALLOUT_MIN_GAP_MS } from "./config.js";

let speakHook = null;
let lastCallout = 0;

export function setCalloutHook(fn) {
  speakHook = fn;
}

function say(instruction, tag, force) {
  const now = Date.now();
  if (!force && now - lastCallout < CALLOUT_MIN_GAP_MS) return;
  lastCallout = now;
  if (typeof speakHook === "function") {
    try { speakHook(instruction, tag); } catch {}
  }
}

export function calloutEngage(targetName) {
  say(`You just started fighting ${targetName || "something"}. Say one short, punchy combat line as you go in.`, "engage");
}

export function calloutTaunt(playerName) {
  say(`You're about to duel ${playerName || "a player"} in pvp because they asked for it. Throw one short cocky taunt.`, "taunt", true);
}

export function calloutCreeper() {
  say("A creeper is getting close while you fight. Shout one short warning about the creeper.", "creeper");
}

export function calloutLowHealth() {
  say("You're getting low on health mid-fight and backing off. Say one short worried line.", "lowhp");
}

export function calloutWinning(targetName) {
  say(`You're winning the fight against ${targetName || "it"}. Say one short confident line.`, "winning");
}

export function calloutVictory(targetName) {
  say(`You just killed ${targetName || "your enemy"}. Say one short victorious line.`, "victory", true);
}

export function calloutDefeatSurvived() {
  say("You barely survived a rough fight. Say one short relieved line.", "survived", true);
}

export function resetCallouts() {
  lastCallout = 0;
}
