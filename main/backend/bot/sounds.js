const SOUND_DESCRIPTIONS = [
  [/zombie/, "a zombie groaning"],
  [/skeleton/, "a skeleton clattering"],
  [/creeper.*(hiss|fuse|primed)/, "a creeper hissing (about to explode)"],
  [/creeper/, "a creeper somewhere"],
  [/spider/, "a spider scuttling"],
  [/enderman/, "an enderman teleporting"],
  [/wither/, "a wither"],
  [/blaze/, "a blaze crackling"],
  [/ghast/, "a ghast wailing"],
  [/slime/, "a slime squelching"],
  [/pig\b/, "a pig"],
  [/cow/, "a cow mooing"],
  [/chicken/, "a chicken clucking"],
  [/sheep/, "a sheep baaing"],
  [/wolf/, "a wolf"],
  [/cat\b/, "a cat"],
  [/villager/, "a villager grumbling"],
  [/witch/, "a witch cackling"],
  [/explod/, "an explosion"],
  [/lightning|thunder/, "thunder cracking"],
  [/portal\.travel/, "the eerie portal sound"],
  [/note_block|noteblock/, "a noteblock playing"],
  [/music_disc|jukebox/, "a music disc playing"],
  [/anvil/, "an anvil clang"],
  [/door/, "a door"],
  [/chest/, "a chest opening"],
  [/glass.*break/, "glass shattering"],
  [/fire\.ambient/, "a crackling fire"],
];

const IGNORE_SOUNDS = [
  /step\./, /random\.click/, /random\.bow/, /random\.pop/, /random\.fizz/,
  /entity\.experience_orb/, /entity\.item\.pickup/, /entity\.player\./,
  /^minecraft:block\..*\.(break|place|hit|step|fall)/,
  /eat/, /drink/, /breath/, /splash/, /swim/, /enchant/,
];

export function describeSound(soundName) {
  if (!soundName) return null;
  const lower = String(soundName).toLowerCase();
  for (const re of IGNORE_SOUNDS) if (re.test(lower)) return null;
  for (const [re, desc] of SOUND_DESCRIPTIONS) {
    if (re.test(lower)) return desc;
  }
  return null;
}
