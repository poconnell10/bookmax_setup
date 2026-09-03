#!/usr/bin/env node
/**
 * Controlled M1 invitation creator.
 *
 * Usage:
 *   npm run create-invitation -- \
 *     --property "Hotel ABC Barcelona" \
 *     --country "Spain" \
 *     --contact-name "Elena Márquez" \
 *     --email "elena.marquez@hotelabc.com" \
 *     --expires-at "2026-12-31T23:59:59.000Z" \
 *     [--brand "Hotel ABC Group"] \
 *     [--base-url "http://localhost:3000"]
 *
 * Prints the raw invitation URL ONCE. Does not print token_hash or credentials.
 * Persists to the DEVELOPMENT Supabase project.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createInvitationService } from "@/lib/implementation/invitation/service";
import { createSupabaseInvitationStore } from "@/lib/implementation/invitation/supabase-store";

function loadLocalEnv() {
  for (const name of [".env.local", ".env"]) {
    const filePath = join(process.cwd(), name);
    if (!existsSync(filePath)) {
      continue;
    }
    for (const line of readFileSync(filePath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function usage(): never {
  console.error(`Usage:
  npm run create-invitation -- \\
    --property <name> \\
    --country <country> \\
    --contact-name <name> \\
    --email <email> \\
    --expires-at <ISO-8601> \\
    [--brand <hotel group>] \\
    [--base-url <url>]`);
  process.exit(1);
}

function readArg(args: string[], name: string): string | undefined {
  const eq = args.find((item) => item.startsWith(`${name}=`));
  if (eq) {
    return eq.slice(name.length + 1);
  }

  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const parts: string[] = [];
  for (let i = index + 1; i < args.length; i += 1) {
    if (args[i].startsWith("--")) {
      break;
    }
    parts.push(args[i]);
  }
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(" ");
}

async function main() {
  loadLocalEnv();

  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
  }

  const propertyName = readArg(args, "--property");
  const country = readArg(args, "--country");
  const contactName = readArg(args, "--contact-name");
  const invitedEmail = readArg(args, "--email");
  const expiresAt = readArg(args, "--expires-at");
  const hotelGroupOrBrand = readArg(args, "--brand") ?? null;
  const baseUrl = readArg(args, "--base-url") || process.env.APP_BASE_URL || "http://localhost:3000";

  if (!propertyName || !country || !contactName || !invitedEmail || !expiresAt) {
    usage();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    console.error("Invitation creation failed.");
    process.exit(1);
  }

  const store = createSupabaseInvitationStore(
    createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
  const service = createInvitationService(store, { baseUrl });

  const result = await service.createInvitation({
    propertyName,
    country,
    contactName,
    invitedEmail,
    hotelGroupOrBrand,
    expiresAt,
  });

  console.log("Invitation created");
  console.log(`Invitation ID: ${result.invitation.id}`);
  console.log(`Property: ${result.invitation.propertyName}`);
  console.log(`Invited email: ${result.invitation.invitedEmail}`);
  console.log(`Expiry: ${result.invitation.expiresAt}`);
  console.log(`Secure invitation URL: ${result.invitationUrl}`);
  console.log("");
  console.log("Store the URL securely. The raw token is not shown again.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Invitation creation failed.";
  if (/supabase|secret|service.role|token_hash/i.test(message)) {
    console.error("Invitation creation failed.");
  } else {
    console.error(message);
  }
  process.exit(1);
});
