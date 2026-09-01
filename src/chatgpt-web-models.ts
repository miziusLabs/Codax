export const CHATGPT_WEB_MODEL_PREFIX = "chatgpt-web/";
export const CHATGPT_WEB_BACKEND_MODEL = "gpt-5.6-sol";
export const CHATGPT_WEB_LUNA_BACKEND_MODEL = "gpt-5.6-luna";

export type ChatGptWebBackendModel =
  | typeof CHATGPT_WEB_BACKEND_MODEL
  | typeof CHATGPT_WEB_LUNA_BACKEND_MODEL;

export type ChatGptWebCodexEffort = "low" | "medium" | "high" | "xhigh" | "max";
export type ChatGptWebAdapterEffort = "low" | "medium" | "high" | "xhigh" | "max";

/** Actual ChatGPT Chat model windows. Browser transport/task budgets are tracked separately. */
export const CHATGPT_WEB_SOL_MODEL_CONTEXT_WINDOW = 272_000;
export const CHATGPT_WEB_LUNA_MODEL_CONTEXT_WINDOW = 128_000;
/** Leave headroom for the next ChatGPT turn instead of compacting exactly at the hard model cap. */
export const CHATGPT_WEB_MODEL_AUTO_COMPACT_PERCENT = 90;

/**
 * Measured Plus browser transport/task windows, including the fixed hidden ChatGPT platform reserve.
 * These values deliberately describe what one browser-compiled Codex turn can safely carry; they
 * are not the underlying ChatGPT model context windows advertised in the Codex model catalog.
 */
export const CHATGPT_WEB_INSTANT_CONTEXT_WINDOW = 41_000;
export const CHATGPT_WEB_INSTANT_AUTO_COMPACT_TOKEN_LIMIT = 32_000;
export const CHATGPT_WEB_MEDIUM_HIGH_CONTEXT_WINDOW = 90_000;
export const CHATGPT_WEB_MEDIUM_HIGH_AUTO_COMPACT_TOKEN_LIMIT = 80_000;
export const CHATGPT_WEB_INSTANT_COMPOSER_CHAR_LIMIT = 211_256;
export const CHATGPT_WEB_MEDIUM_HIGH_COMPOSER_CHAR_LIMIT = 1_048_572;
/** Hidden ChatGPT product prompt and Codex Native schema reserve included in usage estimates. */
export const CHATGPT_WEB_PLATFORM_RESERVE_TOKENS = 8_192;
/** Pro-account usable browser windows and separately measured one-message boundaries. */
export const CHATGPT_WEB_PRO_AUTO_COMPACT_TOKEN_LIMIT = 95_000;
export const CHATGPT_WEB_PRO_STANDARD_MESSAGE_TOKEN_LIMIT = 103_000;
export const CHATGPT_WEB_PRO_MODEL_MESSAGE_TOKEN_LIMIT = 104_000;
// Browser message maxima are inclusive, while the context preflight treats its ceiling as an
// exclusive upper bound. The extra token preserves the last accepted payload exactly.
export const CHATGPT_WEB_PRO_STANDARD_CONTEXT_WINDOW =
  CHATGPT_WEB_PRO_STANDARD_MESSAGE_TOKEN_LIMIT + CHATGPT_WEB_PLATFORM_RESERVE_TOKENS + 1;
export const CHATGPT_WEB_PRO_MODEL_CONTEXT_WINDOW =
  CHATGPT_WEB_PRO_MODEL_MESSAGE_TOKEN_LIMIT + CHATGPT_WEB_PLATFORM_RESERVE_TOKENS + 1;
export const CHATGPT_WEB_PRO_INSTANT_COMPOSER_CHAR_LIMIT = 545_000;
export const CHATGPT_WEB_PRO_REASONING_COMPOSER_CHAR_LIMIT = 1_045_000;
export const CHATGPT_WEB_PRO_MODEL_COMPOSER_CHAR_LIMIT = 1_635_000;
/**
 * Synthetic Codex task budget for Luna checkpoint continuity. This is intentionally larger than
 * Luna's ChatGPT model window because completed history is replaced by a private rolling checkpoint
 * before later browser turns are compiled.
 */
export const CHATGPT_WEB_LUNA_CHECKPOINT_TASK_WINDOW = 1_050_000;

export interface ChatGptWebContextLimits {
  contextWindow: number;
  effectiveContextWindowPercent: number;
  autoCompactTokenLimit: number;
}

export interface ChatGptWebTransportLimits {
  browserMessageTokenLimit?: number;
  browserComposerCharLimit?: number;
}

function contextLimits(
  contextWindow: number,
  autoCompactTokenLimit: number,
): ChatGptWebContextLimits {
  return {
    contextWindow,
    effectiveContextWindowPercent: Math.round((autoCompactTokenLimit / contextWindow) * 100),
    autoCompactTokenLimit,
  };
}

function modelContextWindow(backendModel: ChatGptWebBackendModel): number {
  return backendModel === CHATGPT_WEB_LUNA_BACKEND_MODEL
    ? CHATGPT_WEB_LUNA_MODEL_CONTEXT_WINDOW
    : CHATGPT_WEB_SOL_MODEL_CONTEXT_WINDOW;
}

function maxModelAutoCompactTokenLimit(contextWindow: number): number {
  return Math.floor((contextWindow * CHATGPT_WEB_MODEL_AUTO_COMPACT_PERCENT) / 100);
}

/** Resolve the practical browser/task limit for the selected visible ChatGPT mode. */
export function resolveChatGptWebContextLimits(
  backendModel: ChatGptWebBackendModel,
  effort: ChatGptWebAdapterEffort,
  capabilities: ChatGptWebAccountCapabilities,
): ChatGptWebContextLimits {
  if (backendModel === CHATGPT_WEB_LUNA_BACKEND_MODEL) {
    // Luna carries continuity through a private checkpoint on every completed browser turn. The
    // actual 128K model window is published separately by resolveChatGptWebModelContextLimits().
    return contextLimits(
      CHATGPT_WEB_LUNA_CHECKPOINT_TASK_WINDOW,
      CHATGPT_WEB_LUNA_CHECKPOINT_TASK_WINDOW,
    );
  }

  let limits: ChatGptWebContextLimits;
  if (capabilities.proAvailable) {
    const contextWindow = effort === "low"
      ? CHATGPT_WEB_PRO_STANDARD_CONTEXT_WINDOW
      : effort === "max"
        ? CHATGPT_WEB_PRO_MODEL_CONTEXT_WINDOW
        : CHATGPT_WEB_PRO_STANDARD_CONTEXT_WINDOW;
    limits = contextLimits(contextWindow, CHATGPT_WEB_PRO_AUTO_COMPACT_TOKEN_LIMIT);
  } else if (effort === "low") {
    limits = contextLimits(
      CHATGPT_WEB_INSTANT_CONTEXT_WINDOW,
      CHATGPT_WEB_INSTANT_AUTO_COMPACT_TOKEN_LIMIT,
    );
  } else if (effort === "medium" || effort === "high") {
    limits = contextLimits(
      CHATGPT_WEB_MEDIUM_HIGH_CONTEXT_WINDOW,
      CHATGPT_WEB_MEDIUM_HIGH_AUTO_COMPACT_TOKEN_LIMIT,
    );
  } else {
    throw new Error(`ChatGPT Plus context limit is not defined for unavailable effort: ${effort}`);
  }
  return limits;
}

/**
 * Resolve the ChatGPT model window exposed to Codex. Retained browser conversations already carry
 * completed history inside ChatGPT, so normal follow-ups send only the suffix after the last
 * assistant turn. Per-message browser transport ceilings therefore must not lower Codex's model-
 * level compaction point; they remain enforced separately by resolveChatGptWebContextLimits().
 */
export function resolveChatGptWebModelContextLimits(
  backendModel: ChatGptWebBackendModel,
  _effort: ChatGptWebAdapterEffort,
  _capabilities: ChatGptWebAccountCapabilities,
): ChatGptWebContextLimits {
  const contextWindow = modelContextWindow(backendModel);
  if (backendModel === CHATGPT_WEB_LUNA_BACKEND_MODEL) {
    return contextLimits(contextWindow, contextWindow);
  }
  return contextLimits(contextWindow, maxModelAutoCompactTokenLimit(contextWindow));
}

/** Resolve limits of one visible ChatGPT composer message, independently of model context. */
export function resolveChatGptWebTransportLimits(
  backendModel: ChatGptWebBackendModel,
  effort: ChatGptWebAdapterEffort,
  capabilities: ChatGptWebAccountCapabilities,
): ChatGptWebTransportLimits {
  if (backendModel === CHATGPT_WEB_LUNA_BACKEND_MODEL) return {};
  if (!capabilities.proAvailable) {
    if (effort === "low") {
      return { browserComposerCharLimit: CHATGPT_WEB_INSTANT_COMPOSER_CHAR_LIMIT };
    }
    if (effort === "medium" || effort === "high") {
      return { browserComposerCharLimit: CHATGPT_WEB_MEDIUM_HIGH_COMPOSER_CHAR_LIMIT };
    }
    throw new Error(`ChatGPT Plus transport limit is not defined for unavailable effort: ${effort}`);
  }
  if (effort === "low") {
    return {
      browserMessageTokenLimit: CHATGPT_WEB_PRO_STANDARD_MESSAGE_TOKEN_LIMIT,
      browserComposerCharLimit: CHATGPT_WEB_PRO_INSTANT_COMPOSER_CHAR_LIMIT,
    };
  }
  if (effort === "max") {
    return {
      browserMessageTokenLimit: CHATGPT_WEB_PRO_MODEL_MESSAGE_TOKEN_LIMIT,
      browserComposerCharLimit: CHATGPT_WEB_PRO_MODEL_COMPOSER_CHAR_LIMIT,
    };
  }
  return {
    browserMessageTokenLimit: CHATGPT_WEB_PRO_STANDARD_MESSAGE_TOKEN_LIMIT,
    browserComposerCharLimit: CHATGPT_WEB_PRO_REASONING_COMPOSER_CHAR_LIMIT,
  };
}

export interface ChatGptWebModelRoute {
  slug: string;
  displayName: string;
  description: string;
  backendModel: ChatGptWebBackendModel;
  codexEffort: ChatGptWebCodexEffort;
  adapterEffort: ChatGptWebAdapterEffort;
  requiresPro: boolean;
}

export interface ChatGptWebAccountCapabilities {
  solAvailable: boolean;
  proAvailable: boolean;
}

export const CHATGPT_WEB_LUNA_MODEL_ROUTE: ChatGptWebModelRoute = {
  slug: "chatgpt-web/luna",
  displayName: "ChatGPT Web — Luna",
  description: "ChatGPT Web Luna for accounts without the Sol model selector.",
  backendModel: CHATGPT_WEB_LUNA_BACKEND_MODEL,
  codexEffort: "low",
  adapterEffort: "low",
  requiresPro: false,
};

/**
 * The selected Codex reasoning effort is the authoritative ChatGPT browser mode. A single Sol
 * model advertises every available effort, with `max` binding to ChatGPT Pro. `ultra` is never
 * registered or routed.
 */
export const CHATGPT_WEB_MODEL_ROUTES: readonly ChatGptWebModelRoute[] = [
  {
    slug: "chatgpt-web/gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    description: "ChatGPT Web Instant through the native Codex harness.",
    backendModel: CHATGPT_WEB_BACKEND_MODEL,
    codexEffort: "low",
    adapterEffort: "low",
    requiresPro: false,
  },
  {
    slug: "chatgpt-web/gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    description: "ChatGPT Web Medium through the native Codex harness.",
    backendModel: CHATGPT_WEB_BACKEND_MODEL,
    codexEffort: "medium",
    adapterEffort: "medium",
    requiresPro: false,
  },
  {
    slug: "chatgpt-web/gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    description: "ChatGPT Web High through the native Codex harness.",
    backendModel: CHATGPT_WEB_BACKEND_MODEL,
    codexEffort: "high",
    adapterEffort: "high",
    requiresPro: false,
  },
  {
    slug: "chatgpt-web/gpt-5.6-sol",
    displayName: "ChatGPT Web — Extra High",
    description: "Account-gated ChatGPT Web Extra High through the native Codex harness.",
    backendModel: CHATGPT_WEB_BACKEND_MODEL,
    codexEffort: "xhigh",
    adapterEffort: "xhigh",
    requiresPro: true,
  },
  {
    slug: "chatgpt-web/gpt-5.6-sol",
    displayName: "GPT-5.6 Sol",
    description: "Account-gated ChatGPT Pro through the native Codex harness.",
    backendModel: CHATGPT_WEB_BACKEND_MODEL,
    codexEffort: "max",
    adapterEffort: "max",
    requiresPro: true,
  },
];

const routesBySlug = new Map<string, readonly ChatGptWebModelRoute[]>([
  [CHATGPT_WEB_LUNA_MODEL_ROUTE.slug, [CHATGPT_WEB_LUNA_MODEL_ROUTE]],
  [CHATGPT_WEB_MODEL_ROUTES[0]!.slug, CHATGPT_WEB_MODEL_ROUTES],
]);

export function isChatGptWebModelSlug(modelId: string): boolean {
  return modelId.startsWith(CHATGPT_WEB_MODEL_PREFIX);
}

export function availableChatGptWebModelRoutes(
  capabilities: ChatGptWebAccountCapabilities,
): readonly ChatGptWebModelRoute[] {
  if (!capabilities.solAvailable) return [CHATGPT_WEB_LUNA_MODEL_ROUTE];
  return [CHATGPT_WEB_MODEL_ROUTES[0]!];
}

export function requireChatGptWebModelRoute(
  modelId: string,
  capabilities: ChatGptWebAccountCapabilities,
  effort?: string,
): ChatGptWebModelRoute {
  const candidates = routesBySlug.get(modelId);
  if (!candidates) throw new Error(`ChatGPT web model is not enabled: ${modelId}`);
  if (candidates[0] === CHATGPT_WEB_LUNA_MODEL_ROUTE) {
    const route = CHATGPT_WEB_LUNA_MODEL_ROUTE;
    if (capabilities.solAvailable) {
      throw new Error(`${route.displayName} is only available for Luna-only accounts`);
    }
    return route;
  }
  if (!capabilities.solAvailable) {
    throw new Error(`${candidates[0]!.displayName} is not available for this Luna-only account`);
  }
  const normalizedEffort = effort === "max" ? "max" : effort;
  const route = candidates.find(candidate => candidate.codexEffort === normalizedEffort)
    ?? candidates[0]!;
  if (route.requiresPro && !capabilities.proAvailable) {
    throw new Error(`${route.displayName} is not available for this account`);
  }
  return route;
}
