import { NextResponse } from "next/server";
import { headers } from "next/headers";
import mineflayer from "mineflayer";

const activeBots = new Map<string, { bot: any; timeout: NodeJS.Timeout; info: { ip: string; port: number; version: string; botName: string } }>();

function log(message: string) {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${message}`);
}

function getClientIp(headersList: Headers): string {
  return headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";
}

function validateInput(ip: string, port: number, version: string, botName: string): string | null {
  if (!ip || typeof ip !== "string" || ip.length > 255) return "invalid ip";
  if (!port || port < 1 || port > 65535) return "invalid port";
  if (!version || !/^\d+\.\d+(\.\d+)?$/.test(version)) return "invalid version";
  if (!botName || typeof botName !== "string" || botName.length < 1 || botName.length > 16) return "invalid bot name";
  if (!/^[a-zA-Z0-9_]+$/.test(botName)) return "bot name can only contain letters, numbers, underscore";
  return null;
}

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const clientIp = getClientIp(headersList);

    if (activeBots.has(clientIp)) {
      log(`rejected bot request from ${clientIp} - already has one running`);
      return NextResponse.json({ success: false, error: "you already have a bot running. wait for it to finish." });
    }

    const body = await request.json();
    const { ip, port, version, botName } = body;

    const validationError = validateInput(ip, port, version, botName);
    if (validationError) {
      log(`rejected bot request from ${clientIp} - ${validationError}`);
      return NextResponse.json({ success: false, error: validationError });
    }

    log(`creating bot "${botName}" for ${version} connecting to ${ip}:${port} by ${clientIp}`);

    const bot = mineflayer.createBot({
      host: ip,
      port: port,
      username: botName,
      version: version,
    });

    const botInfo = { ip, port, version, botName };

    const cleanup = (reason: string, errorCode?: string) => {
      const entry = activeBots.get(clientIp);
      if (entry) {
        clearTimeout(entry.timeout);
        activeBots.delete(clientIp);
        if (errorCode) {
          log(`bot left ${entry.info.ip}:${entry.info.port} with name "${entry.info.botName}" - ${reason} (error: ${errorCode})`);
        } else {
          log(`bot left ${entry.info.ip}:${entry.info.port} with name "${entry.info.botName}" - ${reason}`);
        }
      }
    };

    return new Promise((resolve) => {
      const connectionTimeout = setTimeout(() => {
        cleanup("connection timeout");
        try { bot.quit(); } catch {}
        resolve(NextResponse.json({ success: false, error: "connection timeout" }));
      }, 30000);

      bot.once("spawn", () => {
        clearTimeout(connectionTimeout);

        log(`bot "${botName}" joined ${ip}:${port} successfully`);

        bot.chat("hi this is just test demo implementation, real one is in works, i will leave in 5 minutes thanks!");

        const leaveTimeout = setTimeout(() => {
          bot.chat("bye!");
          setTimeout(() => {
            cleanup("5 minute demo ended");
            try { bot.quit(); } catch {}
          }, 1000);
        }, 5 * 60 * 1000);

        activeBots.set(clientIp, { bot, timeout: leaveTimeout, info: botInfo });
        resolve(NextResponse.json({ success: true }));
      });

      bot.once("error", (err: Error) => {
        clearTimeout(connectionTimeout);
        cleanup("error", err.message);
        resolve(NextResponse.json({ success: false, error: err.message }));
      });

      bot.once("end", (reason: string) => {
        cleanup("disconnected", reason);
      });

      bot.once("kicked", (reason: string) => {
        cleanup("kicked", reason);
      });
    });
  } catch (e) {
    const error = e as Error;
    log(`api error: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message });
  }
}
