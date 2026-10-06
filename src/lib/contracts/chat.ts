import { z } from "zod";

const Part = z.object({ type: z.string().max(80), text: z.string().max(6_000).optional() }).passthrough();

export const ChatRequest = z
  .object({
    id: z.string().min(1).max(128),
    plotId: z.string().max(2000),
    at: z.string().max(2000).optional(),
    messages: z
      .array(
        z.object({
          id: z.string().min(1).max(128),
          role: z.enum(["user", "assistant"]),
          parts: z.array(Part).min(1).max(40),
        }),
      )
      .min(1)
      .max(24),
  })
  .superRefine((value, ctx) => {
    if (value.messages.at(-1)?.role !== "user")
      ctx.addIssue({ code: "custom", message: "L’ultimo messaggio deve essere dell’utente." });
    for (const message of value.messages) {
      if (message.role === "user" && message.parts.some((part) => part.type !== "text" || !part.text?.trim()))
        ctx.addIssue({ code: "custom", message: "Sono ammessi solo messaggi di testo." });
    }
    if (
      value.messages.reduce(
        (total, message) => total + message.parts.reduce((sum, part) => sum + (part.text?.length ?? 0), 0),
        0,
      ) > 32_000
    )
      ctx.addIssue({ code: "custom", message: "Conversazione troppo lunga." });
  });
