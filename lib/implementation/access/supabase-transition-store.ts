import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccessTransitionStore } from "@/lib/implementation/access/transition-store";
import { InternalError } from "@/lib/implementation/internal/types";

/**
 * Delegates the whole conversion to public.access_change_account_type, which
 * runs as one statement. Any failure inside it, including the
 * ACCOUNT_TYPE_CHANGED audit insert, rolls the entire transition back, so the
 * original authorization state survives.
 */
function raise(error: { message?: string } | null): never {
  const message = error?.message ?? "";
  if (message.includes("forbidden:") || message.toLowerCase().includes("last active admin")) {
    throw new InternalError("forbidden", "That access change is not permitted.");
  }
  if (message.includes("not_found:")) {
    throw new InternalError("not_found", "That record was not found.");
  }
  if (message.includes("invalid_input:")) {
    throw new InternalError("invalid_input", "That access change is not supported.");
  }
  throw new InternalError("unavailable", "The service is temporarily unavailable. Please try again.");
}

export function createSupabaseTransitionStore(client: SupabaseClient): AccessTransitionStore {
  return {
    async changeAccountType(input) {
      const { error } = await client.rpc("access_change_account_type", {
        p_actor_user_id: input.actorUserId,
        p_target_user_id: input.targetUserId,
        p_account_type: input.accountType,
        p_role: input.accountType === "internal" ? input.role : null,
        p_implementation_id: input.accountType === "customer" ? input.implementationId : null,
      });
      if (error) {
        raise(error);
      }
    },

    async disable(input) {
      const { error } = await client.rpc("access_disable", {
        p_actor_user_id: input.actorUserId,
        p_target_user_id: input.targetUserId,
      });
      if (error) {
        raise(error);
      }
    },

    async reactivate(input) {
      const { error } = await client.rpc("access_reactivate", {
        p_actor_user_id: input.actorUserId,
        p_target_user_id: input.targetUserId,
      });
      if (error) {
        raise(error);
      }
    },
  };
}
