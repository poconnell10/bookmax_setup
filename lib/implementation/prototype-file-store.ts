import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { prototypeFilePersistenceEnabled } from "@/lib/implementation/persistence-config";

/** Replace the destination only after a complete private temporary file is written. */
export async function writePrototypeSnapshot(
  file: string,
  contents: string,
): Promise<void> {
  if (!prototypeFilePersistenceEnabled()) {
    throw new Error(
      "Prototype file writes require explicit local development.",
    );
  }
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, contents, { flag: "wx", mode: 0o600 });
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
