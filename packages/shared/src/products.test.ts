import { describe, it, expect } from "vitest";
import { insertProductWithPhotos } from "./products";

// Minimale fake Supabase-client die alleen de chained calls ondersteunt die
// insertProductWithPhotos gebruikt. Legt vast of rollback-acties (product
// delete, storage remove) zijn aangeroepen, zodat we de foutpaden kunnen testen.
function makeClient(opts: {
  productResult: { data: { id: string } | null; error: { message: string; code?: string } | null };
  photoError?: { message: string; code?: string } | null;
}) {
  const calls = {
    productDeleted: false,
    photosInserted: false,
    storageRemoved: [] as string[][],
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    from(table: string) {
      if (table === "products") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => opts.productResult,
            }),
          }),
          delete: () => ({
            eq: async () => {
              calls.productDeleted = true;
              return { error: null };
            },
          }),
        };
      }
      return {
        insert: async () => {
          calls.photosInserted = true;
          return { error: opts.photoError ?? null };
        },
      };
    },
    storage: {
      from() {
        return {
          remove: async (paths: string[]) => {
            calls.storageRemoved.push(paths);
            return { error: null };
          },
        };
      },
    },
  };
  return { client, calls };
}

const baseArgs = {
  product: { user_id: "u1" },
  photos: [{ storage_path: "u1/inbox/a.jpg", order_index: 0, user_id: "u1" }],
  cleanupPaths: ["u1/inbox/a.jpg"],
};

describe("insertProductWithPhotos", () => {
  it("maakt product + foto's aan bij succes, zonder rollback", async () => {
    const { client, calls } = makeClient({
      productResult: { data: { id: "p1" }, error: null },
    });
    const res = await insertProductWithPhotos(client, baseArgs);
    expect(res).toEqual({ ok: true, product: { id: "p1" } });
    expect(calls.photosInserted).toBe(true);
    expect(calls.productDeleted).toBe(false);
    expect(calls.storageRemoved).toEqual([]);
  });

  it("ruimt uploads op als de product-insert faalt", async () => {
    const { client, calls } = makeClient({
      productResult: { data: null, error: { message: "boom", code: "500" } },
    });
    const res = await insertProductWithPhotos(client, baseArgs);
    expect(res.ok).toBe(false);
    expect(calls.photosInserted).toBe(false);
    expect(calls.storageRemoved).toEqual([["u1/inbox/a.jpg"]]);
  });

  it("vlagt een sticker-conflict (23505 op sticker_id)", async () => {
    const { client } = makeClient({
      productResult: {
        data: null,
        error: {
          message: 'duplicate key value violates unique constraint "products_sticker_id_key"',
          code: "23505",
        },
      },
    });
    const res = await insertProductWithPhotos(client, baseArgs);
    expect(res).toMatchObject({ ok: false, stickerConflict: true });
  });

  it("rolt product + uploads terug als de foto-insert faalt", async () => {
    const { client, calls } = makeClient({
      productResult: { data: { id: "p1" }, error: null },
      photoError: { message: "photo boom", code: "x" },
    });
    const res = await insertProductWithPhotos(client, baseArgs);
    expect(res.ok).toBe(false);
    expect(calls.productDeleted).toBe(true);
    expect(calls.storageRemoved).toEqual([["u1/inbox/a.jpg"]]);
  });

  it("slaat de foto-insert over als er geen foto's zijn", async () => {
    const { client, calls } = makeClient({
      productResult: { data: { id: "p1" }, error: null },
    });
    const res = await insertProductWithPhotos(client, {
      product: { user_id: "u1" },
      photos: [],
    });
    expect(res.ok).toBe(true);
    expect(calls.photosInserted).toBe(false);
  });
});
