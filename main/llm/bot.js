import mineflayer from "mineflayer";

export function createBot(options) {
  const bot = mineflayer.createBot({
    host: options.ip,
    port: options.port,
    username: options.botName,
    version: options.version,
  });

  bot.once("spawn", () => {
    bot.chat("hi this is just test demo implementation, real one is in works, i will leave in 5 minutes thanks!");

    setTimeout(() => {
      bot.chat("bye!");
      bot.quit();
    }, 5 * 60 * 1000);
  });

  bot.on("error", (err) => {
    console.error("bot error:", err.message);
  });

  return bot;
}
