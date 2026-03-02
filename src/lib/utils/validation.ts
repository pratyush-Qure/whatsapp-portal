import { z } from "zod";

export const conditionSchema = z.object({
  field: z.string(),
  op: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains", "exists"]),
  value: z.unknown(),
});

export const ruleTreeSchema = z.object({
  and: z.array(conditionSchema).optional(),
  or: z.array(conditionSchema).optional(),
});

export const createTriggerSchema = z.object({
  project_id: z.string().uuid(),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(100),
  source_type: z.enum(["webhook", "cron", "api", "event", "manual"]),
  template_id: z.string().uuid(),
  recipient_path: z.string().min(1).default("phone"),
  config_json: z.record(z.string(), z.unknown()).optional().default({}),
  conditions_json: ruleTreeSchema.optional(),
  status: z.enum(["active", "paused", "draft"]).optional().default("active"),
});

export const createTemplateSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  category: z.enum(["utility", "marketing", "authentication"]),
  language: z.string().default("en"),
  header_type: z.enum(["none", "text", "image", "video", "document"]).optional(),
  header_content: z.string().optional(),
  body: z.string().min(1),
  footer: z.string().optional(),
  buttons_json: z.array(z.unknown()).optional().default([]),
  variables: z.array(
    z.object({
      position: z.number().int().positive(),
      name: z.string(),
      type: z.enum(["text", "number", "date", "url", "phone"]),
      source: z.enum(["payload", "static", "computed"]),
      payload_path: z.string().optional(),
      static_value: z.string().optional(),
      compute_expr: z.string().optional(),
      required: z.boolean().default(true),
    })
  ).optional().default([]),
});

export const inboundPayloadSchema = z.object({
  idempotency_key: z.string().optional(),
}).passthrough();

export const createGroupSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/).optional(),
  description: z.string().max(500).optional(),
  default_trigger_id: z.string().uuid().nullable().optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/).optional(),
  description: z.string().max(500).optional(),
  default_trigger_id: z.string().uuid().nullable().optional(),
});

export const triggerFormSchema = z.object({
  project_id: z.string().uuid().optional(),
  slug: z.string().min(3, "Slug must be at least 3 characters").max(50).regex(/^[a-z0-9_]+$/, "Slug: lowercase letters, numbers, underscores only"),
  name: z.string().min(1, "Name is required").max(100),
  template_id: z.string().uuid("Select a template"),
  recipient_path: z.string().min(1).default("phone"),
  status: z.enum(["active", "paused", "draft"]).optional(),
  http_method: z.enum(["GET", "POST"]).optional(),
});

export const templateFormSchema = z.object({
  project_id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required").max(100),
  category: z.enum(["utility", "marketing", "authentication"]),
  language: z.string().min(1).default("en"),
  body: z.string().min(1, "Body is required"),
  footer: z.string().optional(),
});
