import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdentityStore } from "@/lib/implementation/access/identity-store";
import type { AccessIdentity } from "@/lib/implementation/access/types";
import { InternalError } from "@/lib/implementation/internal/types";

export function createSupabaseIdentityStore(client: SupabaseClient): IdentityStore {
  return {
    async list() {
      const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) {
        throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
      }
      return (data.users ?? []).map(mapUser);
    },
    async getById(userId) {
      const { data, error } = await client.auth.admin.getUserById(userId);
      if (error || !data.user) {
        return null;
      }
      return mapUser(data.user);
    },
  };
}

function mapUser(user: {
  id: string;
  email?: string;
  last_sign_in_at?: string;
  created_at: string;
}): AccessIdentity {
  return {
    userId: user.id,
    email: user.email ?? "",
    lastSignInAt: user.last_sign_in_at ?? null,
    createdAt: user.created_at,
  };
}
