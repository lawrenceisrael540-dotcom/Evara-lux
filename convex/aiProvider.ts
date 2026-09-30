type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: unknown }

type ProviderTool = {
  name: string
  description: string
  parameters: Record<string, unknown>
}

type ProviderResponse = {
  text?: string
  finishReason?: string
  toolCalls?: Array<{ toolCallId: string; toolName: string; input: unknown }>
  model?: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`AI_NOT_CONFIGURED:${name}`)
  return value
}

function modelFor(rank: number): string {
  const premium = process.env.AI_PREMIUM_MODEL?.trim()
  const standard = process.env.AI_DEFAULT_MODEL?.trim()
  if (rank >= 3 && premium) return premium
  if (standard) return standard
  if (premium) return premium
  throw new Error("AI_NOT_CONFIGURED:AI_DEFAULT_MODEL")
}

/**
 * Provider-neutral OpenAI-compatible adapter.
 *
 * The application does not depend on Macaly or a model vendor. Configure:
 * AI_API_URL, AI_API_KEY, AI_DEFAULT_MODEL and optionally AI_PREMIUM_MODEL.
 * The endpoint must implement the Chat Completions request/response shape.
 */
export async function callAiJson(args: {
  rank: number
  messages: ChatMessage[]
  tools: ProviderTool[]
  temperature: number
  maxTokens: number
}): Promise<ProviderResponse> {
  const url = requiredEnv("AI_API_URL")
  const key = requiredEnv("AI_API_KEY")
  const model = modelFor(args.rank)

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: args.messages,
      temperature: args.temperature,
      max_tokens: args.maxTokens,
      tools: args.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      tool_choice: "auto",
    }),
  })

  const body = await response.json().catch(() => ({})) as any
  if (!response.ok) {
    throw new Error(`AI_PROVIDER_ERROR:${response.status}`)
  }

  const choice = body?.choices?.[0]
  const message = choice?.message
  const toolCalls = Array.isArray(message?.tool_calls)
    ? message.tool_calls.map((call: any) => ({
        toolCallId: String(call.id),
        toolName: String(call.function?.name ?? ""),
        input: (() => {
          try { return JSON.parse(call.function?.arguments ?? "{}") } catch { return {} }
        })(),
      }))
    : []

  return {
    text: typeof message?.content === "string" ? message.content : undefined,
    finishReason: choice?.finish_reason === "tool_calls" ? "tool-calls" : choice?.finish_reason,
    toolCalls,
    model: typeof body?.model === "string" ? body.model : model,
  }
}
