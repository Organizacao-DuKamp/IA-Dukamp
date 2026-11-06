import { z } from "zod";
const label = z.string().trim().min(1).max(160);
export const EmployeeSchema = z
  .object({
    id: label,
    name: label,
    job: label,
    active: z.boolean(),
    phone: z
      .string()
      .regex(/^\d{10,15}$/)
      .optional(),
  })
  .strict();
export const EmployeeActionSchema = z
  .object({ kind: z.literal("employee_save"), ...EmployeeSchema.shape })
  .strict();
