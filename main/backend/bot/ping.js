import mc from "minecraft-protocol";

const ping = mc.ping;

const [host, portArg] = process.argv.slice(2);
const port = parseInt(portArg) || 25565;

const TIMEOUT_MS = 4500;

const timer = setTimeout(() => {
  process.stderr.write("timeout\n");
  process.exit(2);
}, TIMEOUT_MS);

try {
  const result = await ping({ host, port });
  clearTimeout(timer);
  const v = result?.version?.name || "unknown";
  const players = result?.players?.online ?? "?";
  process.stdout.write(`ok|${v}|${players}\n`);
  process.exit(0);
} catch (e) {
  clearTimeout(timer);
  let msg = e.message || String(e);
  if (e.errors && Array.isArray(e.errors) && e.errors.length) {
    msg = e.errors.map(x => x.message || String(x)).join("; ");
  }
  if (e.code) msg = `${e.code} ${msg}`;
  process.stderr.write(`${msg}\n`);
  process.exit(1);
}
