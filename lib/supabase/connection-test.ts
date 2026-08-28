export const CONNECTION_TEST_TABLE = "bookmax_connection_test";

export type PrivilegedConnectionResult = {
  ok: boolean;
  write: boolean;
  read: boolean;
  id: string | null;
};

type InsertResult = {
  data: { id: string; created_at: string } | null;
  error: { message?: string } | null;
};

type ReadResult = {
  data: { id: string; test_value: string; created_at: string } | null;
  error: { message?: string } | null;
};

export type ConnectionTestClient = {
  from: (table: string) => {
    insert: (row: { test_value: string }) => {
      select: (columns: string) => {
        single: () => Promise<InsertResult>;
      };
    };
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => Promise<ReadResult>;
      };
    };
  };
};

export async function runPrivilegedConnectionTest(
  client: ConnectionTestClient,
): Promise<PrivilegedConnectionResult> {
  const testValue = `m0-connectivity-${Date.now()}`;

  const inserted = await client
    .from(CONNECTION_TEST_TABLE)
    .insert({ test_value: testValue })
    .select("id, created_at")
    .single();

  if (inserted.error || !inserted.data?.id) {
    return { ok: false, write: false, read: false, id: null };
  }

  const read = await client
    .from(CONNECTION_TEST_TABLE)
    .select("id, test_value, created_at")
    .eq("id", inserted.data.id)
    .single();

  const matched = read.data?.id === inserted.data.id && read.data.test_value === testValue;

  return {
    ok: matched,
    write: true,
    read: Boolean(matched),
    id: matched ? inserted.data.id : null,
  };
}
