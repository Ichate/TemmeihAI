import { args } from "./ctx.js";

const prefix = `[${args.botName}]`;

export const log = {
  info:  msg => process.stdout.write(`${prefix} ${msg}\n`),
  warn:  msg => process.stdout.write(`${prefix} WARN ${msg}\n`),
  error: msg => process.stderr.write(`${prefix} ERROR ${msg}\n`),
};
