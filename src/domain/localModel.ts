/**
 * Optional local model sharpening, via Ollama on this machine.
 *
 * The composed pitch is complete without any of this. A model is offered only
 * to tighten wording, and it runs locally so an unsent draft naming a brand,
 * a price and a contact never leaves the machine. If Ollama is not running,
 * every function here fails quietly and the deterministic draft stands.
 */

const OLLAMA = 'http://localhost:11434';

export interface LocalModelStatus {
  available: boolean;
  models: string[];
}

/** Ask Ollama what it has loaded. Returns an empty list if it is not running. */
export async function probeLocalModels(): Promise<LocalModelStatus> {
  try {
    const response = await fetch(`${OLLAMA}/api/tags`, { method: 'GET' });
    if (!response.ok) return { available: false, models: [] };
    const data: unknown = await response.json();
    const models = Array.isArray((data as { models?: unknown }).models)
      ? ((data as { models: Array<{ name?: string }> }).models
          .map((m) => m.name)
          .filter((n): n is string => typeof n === 'string'))
      : [];
    return { available: models.length > 0, models };
  } catch {
    return { available: false, models: [] };
  }
}

const SHARPEN_INSTRUCTION = [
  'You are editing a cold sponsorship email written by a creator to a brand.',
  'Tighten the wording. Keep every number, price and factual claim exactly as written.',
  'Do not add flattery, do not add adjectives, do not invent results.',
  'Keep it under 150 words. Keep the same structure and the same sign-off.',
  'Return only the edited email body, with no preamble and no commentary.',
].join(' ');

/**
 * Ask a local model to tighten a draft.
 * @returns the edited body, or null if the model is unavailable or fails.
 */
export async function sharpenDraft(model: string, body: string): Promise<string | null> {
  try {
    const response = await fetch(`${OLLAMA}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${SHARPEN_INSTRUCTION}\n\n---\n${body}\n---`,
        stream: false,
        options: { temperature: 0.2 },
      }),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const text = (data as { response?: unknown }).response;
    return typeof text === 'string' && text.trim().length > 0 ? text.trim() : null;
  } catch {
    return null;
  }
}
