import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth.server";

const bodySchema = z.object({ messages: z.array(z.custom<UIMessage>()).max(30) });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authUser = await getCurrentUser(request);
        if (!authUser) {
          return Response.json(
            { message: "Authentication required to use the parking assistant." },
            { status: 401 },
          );
        }

        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success)
          return Response.json(
            { message: "Please send a shorter parking question." },
            { status: 400 },
          );
        const key = process.env["LOVABLE_API_KEY"];
        if (!key)
          return Response.json(
            { message: "Parking AI is not configured right now." },
            { status: 401 },
          );
        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });
        const result = streamText({
          model: lovable.responses("openai/gpt-6-astra"),
          system:
            "You are the concise parking concierge for ParkGrid One at Bandra Kurla Complex (BKC), Mumbai. Use only official RAG knowledge: 150 total slots (73 available, 62 occupied, 15 reserved); 5 parking levels: B1 & B2 (Basement), G1 (Ground), L1 & L2 (Upper floors); Heavy vehicles are allowed ONLY on Ground (G1) and Basement (B1/B2) levels; Open 24/7; Standard parking ₹50/hour + 18% GST; EV bays ₹70/hour and fast charging at ₹12/kWh (six 60 kW CCS2 & 22 kW Type-2 chargers); Contactless QR code barriers; Speed limit strictly 8 km/h; 15-minute departure grace period; Cancellations: 100% refund if cancelled > 2 hrs before start, 50% between 30m and 2 hrs, non-refundable within 30 mins; Entrance from the main BKC access road (G-Block); Phone +91 20 4827 2400; Email help@parkgrid.one. If asked for private booking data, explain that account lookup is not connected in this demo. Never invent policies. Keep answers under 120 words and use helpful markdown.",
          messages: await convertToModelMessages(parsed.data.messages),
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });
        return result.toUIMessageStreamResponse({ originalMessages: parsed.data.messages });
      },
    },
  },
});
