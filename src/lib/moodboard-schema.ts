import "server-only";
import { z } from "zod";
import { MOOD_BOARDS, MOOD_FONTS, MOOD_GROUP_COLORS, MOOD_LIMITS, MOOD_TAG_MAX } from "./moodboard";

const coord = z.number().finite().min(-100_000).max(100_000);
const len = z.number().finite().min(1).max(20_000);
const id = z.string().min(1).max(64);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const stroke = z.number().min(1).max(24);
const local = z.number().finite().min(-1000).max(21_000);

const base = {
  id,
  x: coord,
  y: coord,
  w: len.optional(),
  h: len.optional(),
  title: z.string().max(120),
  tags: z.array(z.string().trim().min(1).max(MOOD_TAG_MAX)).max(MOOD_LIMITS.tags),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
};

export const nodeSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("photo"),
    fileId: z.uuid().optional(),
    fit: z.enum(["cover", "contain"]).optional(),
    focus: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("media"),
    url: z.url({ protocol: /^https?$/ }).max(2000),
    media: z
      .array(z.object({ fileId: z.uuid(), kind: z.enum(["image", "video"]), w: len.optional(), h: len.optional() }))
      .min(1)
      .max(MOOD_LIMITS.media),
  }),
  z.object({ ...base, type: z.literal("note"), text: z.string().max(2000).optional() }),
  z.object({ ...base, type: z.literal("palette"), swatches: z.array(hex).max(MOOD_LIMITS.swatches).optional() }),
  z.object({
    ...base,
    type: z.literal("text"),
    text: z.string().max(MOOD_LIMITS.text),
    font: z.enum(Object.keys(MOOD_FONTS) as [string, ...string[]]),
    fontSize: z.number().min(8).max(200),
    weight: z.union([z.literal(400), z.literal(700)]).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    color: hex,
  }),
  z.object({
    ...base,
    type: z.literal("shape"),
    shape: z.enum(["rect", "ellipse", "line", "arrow"]),
    color: hex,
    fill: hex.optional(),
    strokeWidth: stroke,
    points: z.array(local).length(4).optional(),
    vw: len.optional(),
    vh: len.optional(),
  }),
  z.object({
    ...base,
    type: z.literal("draw"),
    color: hex,
    strokeWidth: stroke,
    points: z.array(local).min(2).max(MOOD_LIMITS.points, "Goresan terlalu panjang."),
    vw: len,
    vh: len,
  }),
]);

const edgeSchema = z.object({ id, from: id, to: id, label: z.string().max(80) });
const groupSchema = z.object({
  id,
  x: coord,
  y: coord,
  w: z.number().min(240).max(20_000),
  h: z.number().min(140).max(20_000),
  title: z.string().max(80),
  color: z.enum(Object.keys(MOOD_GROUP_COLORS) as [string, ...string[]]),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

export const dataSchema = z.object({
  nodes: z.array(nodeSchema).max(MOOD_LIMITS.nodes, `Maksimal ${MOOD_LIMITS.nodes} elemen per papan.`),
  edges: z.array(edgeSchema).max(MOOD_LIMITS.edges),
  groups: z.array(groupSchema).max(MOOD_LIMITS.groups, `Maksimal ${MOOD_LIMITS.groups} kelompok per papan.`),
});

const coll = z.enum(["nodes", "edges", "groups"]);
export const opSchema = z.union([
  z.object({ t: z.literal("put"), c: z.literal("nodes"), item: nodeSchema }),
  z.object({ t: z.literal("put"), c: z.literal("edges"), item: edgeSchema }),
  z.object({ t: z.literal("put"), c: z.literal("groups"), item: groupSchema }),
  // Isi `set` diperiksa lewat dataSchema setelah digabung ke elemennya; id dan tipe tidak boleh diubah.
  z.object({
    t: z.literal("patch"),
    c: coll,
    id,
    set: z.record(z.string().max(32), z.unknown()).refine((o) => Object.keys(o).length <= 30 && !("id" in o) && !("type" in o)),
  }),
  z.object({ t: z.literal("del"), c: coll, id }),
  z.object({ t: z.literal("front"), id }),
  z.object({ t: z.literal("z"), id, to: z.number().int().min(0).max(MOOD_LIMITS.nodes) }),
]);

export const boardId = z.enum(MOOD_BOARDS.map((b) => b.id) as [string, ...string[]]);
