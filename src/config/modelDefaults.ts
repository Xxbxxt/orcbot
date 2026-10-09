/**
 * Default model ids used when neither the user's config nor an explicit argument supplies one.
 *
 * These live in one place on purpose. They were previously duplicated across eight files, which
 * is exactly how several of them ended up pointing at retired models — `claude-3-5-haiku-latest`
 * and `google/gemini-2.0-flash-exp:free` were both gone from the provider catalogues while still
 * being handed out as fallbacks.
 *
 * Verified against OpenRouter's live model catalogue (https://openrouter.ai/api/v1/models).
 * When refreshing, check that each id still resolves before changing it.
 */
export const DEFAULT_MODEL_IDS = {
    /** Main reasoning model when nothing is configured. */
    openaiMain: 'gpt-5.4',
    /** Cheap/fast model for classification, JSON repair and probe calls. */
    openaiFast: 'gpt-5.4-mini',
    /** Anthropic's cheap/fast tier. */
    anthropicFast: 'claude-haiku-4.5',
    /** Google's cheap/fast tier. */
    googleFast: 'gemini-flash-lite-latest',
    /** OpenRouter default when no model is set; free tier. */
    openRouter: 'google/gemma-4-31b-it:free',
    /** Bedrock, mirroring the Anthropic fast pick. */
    bedrock: 'bedrock:anthropic.claude-haiku-4-5',
    nvidia: 'nvidia:moonshotai/kimi-k2.5',
    ollama: 'ollama:llama3',
} as const;
