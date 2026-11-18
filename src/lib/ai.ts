/**
 * Non-streaming LLM completion provider. Adapted from the parent project's
 * streaming ChatProvider pattern. Used by `llm-graph-generator.ts` to turn a
 * natural-language pipeline description into a JSON node graph.
 *
 * The interface is intentionally minimal: `complete({ systemPrompt, userPrompt })`
 * returns the full text response. The caller is responsible for parsing the
 * text into a structured object (see `parseGraphResponse`).
 */

export interface LlmProvider {
  complete(args: {
    systemPrompt: string
    userPrompt: string
  }): Promise<string>
}

let cachedProvider: LlmProvider | null = null

class ZaiProvider implements LlmProvider {
  async complete(args: {
    systemPrompt: string
    userPrompt: string
  }): Promise<string> {
    const ZAI = (await import("z-ai-web-dev-sdk")).default
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: args.systemPrompt },
        { role: "user", content: args.userPrompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    })
    if (typeof completion === "string") return completion
    const content = (completion as any)?.choices?.[0]?.message?.content
    return typeof content === "string" ? content : ""
  }
}

class MockProvider implements LlmProvider {
  async complete(args: {
    systemPrompt: string
    userPrompt: string
  }): Promise<string> {
    return `**[mock LLM]** Echo: ${args.userPrompt.slice(0, 200)}`
  }
}

export function getLlmProvider(): LlmProvider {
  if (cachedProvider) return cachedProvider
  if (
    process.env.PKC_DISABLE_LLM === "1" ||
    process.env.CICD_DISABLE_LLM === "1"
  ) {
    cachedProvider = new MockProvider()
    return cachedProvider
  }
  try {
    cachedProvider = new ZaiProvider()
  } catch (e) {
    console.warn(
      "[llm] ZaiProvider unavailable, using MockProvider:",
      (e as Error).message,
    )
    cachedProvider = new MockProvider()
  }
  return cachedProvider
}

/** Test-only. */
export function __setLlmProviderForTest(p: LlmProvider | null) {
  cachedProvider = p
}
