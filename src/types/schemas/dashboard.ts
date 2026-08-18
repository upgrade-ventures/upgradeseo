import { z } from "zod";

export const dashboardProjectInputSchema = z.object({
  projectId: z.string().min(1),
});
