import { z } from "zod";

export const AppListingSchema = z.object({
  appName: z.string().min(1).max(60),
  platform: z.enum(["ios", "android", "both"]),
  category: z.string().min(1).max(60),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(120).optional(),
  keywords: z.string().max(300).optional(),
  shortDescription: z.string().max(300).optional(),
  description: z.string().min(1).max(6000),
  screenshotCount: z.number().int().min(0).max(50).optional(),
  hasVideo: z.boolean().optional(),
  whatItDoes: z.string().min(1).max(400),
});

export type AppListingInput = z.infer<typeof AppListingSchema>;
