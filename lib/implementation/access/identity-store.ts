import type { AccessIdentity } from "@/lib/implementation/access/types";

export type IdentityStore = {
  list(): Promise<AccessIdentity[]>;
  getById(userId: string): Promise<AccessIdentity | null>;
};

export type MemoryIdentityStore = IdentityStore & {
  seed(row: AccessIdentity): void;
};

export function createMemoryIdentityStore(seed: AccessIdentity[] = []): MemoryIdentityStore {
  const rows = new Map(seed.map((row) => [row.userId, row]));
  return {
    async list() {
      return [...rows.values()];
    },
    async getById(userId) {
      return rows.get(userId) ?? null;
    },
    seed(row) {
      rows.set(row.userId, row);
    },
  };
}
