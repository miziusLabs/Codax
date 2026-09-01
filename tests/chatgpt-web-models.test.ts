import { describe, expect, test } from "bun:test";
import { chatGptConversationKey } from "../src/adapters/chatgpt-web/conversation-key";
import {
  availableChatGptWebModelRoutes,
  CHATGPT_WEB_BACKEND_MODEL,
  CHATGPT_WEB_LUNA_BACKEND_MODEL,
  CHATGPT_WEB_LUNA_MODEL_ROUTE,
  CHATGPT_WEB_MODEL_ROUTES,
  requireChatGptWebModelRoute,
  resolveChatGptWebContextLimits,
  resolveChatGptWebModelContextLimits,
  resolveChatGptWebTransportLimits,
} from "../src/chatgpt-web-models";
import { defaultConfig } from "../src/config";
import { routeChatGptWebRequest } from "../src/server";
import type { CodexParsedRequest } from "../src/types";

function parsed(modelId: string, reasoning = "medium"): CodexParsedRequest {
  return {
    modelId,
    context: { messages: [] },
    stream: false,
    options: { reasoning },
    _rawBody: { model: modelId, reasoning: { effort: reasoning } },
  };
}

describe("ChatGPT Web model routing", () => {
  const plus = { solAvailable: true, proAvailable: false };
  const pro = { solAvailable: true, proAvailable: true };

  test("uses one stable Sol slug with selectable reasoning efforts", () => {
    expect(new Set(CHATGPT_WEB_MODEL_ROUTES.map(route => route.slug))).toEqual(new Set(["chatgpt-web/gpt-5.6-sol"]));
    expect(CHATGPT_WEB_MODEL_ROUTES.map(route => [route.slug, route.codexEffort, route.adapterEffort])).toEqual([
      ["chatgpt-web/gpt-5.6-sol", "low", "low"],
      ["chatgpt-web/gpt-5.6-sol", "medium", "medium"],
      ["chatgpt-web/gpt-5.6-sol", "high", "high"],
      ["chatgpt-web/gpt-5.6-sol", "xhigh", "xhigh"],
      ["chatgpt-web/gpt-5.6-sol", "max", "max"],
    ]);
    expect(CHATGPT_WEB_MODEL_ROUTES.slice(0, 3).map(route => route.displayName)).toEqual([
      "GPT-5.6 Sol",
      "GPT-5.6 Sol",
      "GPT-5.6 Sol",
    ]);
  });

  test("exposes one Sol model and gates Pro-only reasoning modes", () => {
    expect(availableChatGptWebModelRoutes(plus).map(route => route.slug)).toEqual([
      "chatgpt-web/gpt-5.6-sol",
    ]);
    expect(availableChatGptWebModelRoutes({ solAvailable: true, proAvailable: true }))
      .toEqual([CHATGPT_WEB_MODEL_ROUTES[0]]);
    expect(() => requireChatGptWebModelRoute("chatgpt-web/gpt-5.6-sol", plus, "xhigh"))
      .toThrow("Extra High is not available for this account");
    expect(() => requireChatGptWebModelRoute("chatgpt-web/gpt-5.6-sol", plus, "max"))
      .toThrow("GPT-5.6 Sol is not available for this account");
  });

  test("exposes only Luna when the authenticated account has no Sol selector", () => {
    const free = { solAvailable: false, proAvailable: false };
    expect(availableChatGptWebModelRoutes(free)).toEqual([CHATGPT_WEB_LUNA_MODEL_ROUTE]);
    expect(requireChatGptWebModelRoute("chatgpt-web/luna", free).backendModel)
      .toBe(CHATGPT_WEB_LUNA_BACKEND_MODEL);
    expect(() => requireChatGptWebModelRoute("chatgpt-web/gpt-5.6-sol", free))
      .toThrow("Luna-only account");
    expect(() => requireChatGptWebModelRoute("chatgpt-web/luna", {
      solAvailable: true,
      proAvailable: false,
    })).toThrow("only available for Luna-only accounts");
  });

  test("keeps measured Plus browser windows separate from the actual Sol model window", () => {
    expect(resolveChatGptWebContextLimits(CHATGPT_WEB_BACKEND_MODEL, "low", plus)).toEqual({
      contextWindow: 41_000,
      effectiveContextWindowPercent: 78,
      autoCompactTokenLimit: 32_000,
    });
    expect(resolveChatGptWebContextLimits(CHATGPT_WEB_BACKEND_MODEL, "medium", plus)).toEqual({
      contextWindow: 90_000,
      effectiveContextWindowPercent: 89,
      autoCompactTokenLimit: 80_000,
    });
    expect(resolveChatGptWebContextLimits(CHATGPT_WEB_BACKEND_MODEL, "high", plus)).toEqual({
      contextWindow: 90_000,
      effectiveContextWindowPercent: 89,
      autoCompactTokenLimit: 80_000,
    });
    expect(resolveChatGptWebModelContextLimits(CHATGPT_WEB_BACKEND_MODEL, "low", plus)).toEqual({
      contextWindow: 272_000,
      effectiveContextWindowPercent: 90,
      autoCompactTokenLimit: 244_800,
    });
    for (const effort of ["medium", "high"] as const) {
      expect(resolveChatGptWebModelContextLimits(CHATGPT_WEB_BACKEND_MODEL, effort, plus)).toEqual({
        contextWindow: 272_000,
        effectiveContextWindowPercent: 90,
        autoCompactTokenLimit: 244_800,
      });
    }
    expect(resolveChatGptWebTransportLimits(CHATGPT_WEB_BACKEND_MODEL, "low", plus)).toEqual({
      browserComposerCharLimit: 211_256,
    });
    expect(resolveChatGptWebTransportLimits(CHATGPT_WEB_BACKEND_MODEL, "medium", plus)).toEqual({
      browserComposerCharLimit: 1_048_572,
    });
    expect(() => resolveChatGptWebContextLimits(CHATGPT_WEB_BACKEND_MODEL, "xhigh", plus))
      .toThrow("unavailable effort");
  });

  test("keeps measured Pro browser windows separate from the 272K Sol model window", () => {
    expect(resolveChatGptWebContextLimits(CHATGPT_WEB_BACKEND_MODEL, "low", pro)).toEqual({
      contextWindow: 111_193,
      effectiveContextWindowPercent: 85,
      autoCompactTokenLimit: 95_000,
    });
    for (const effort of ["medium", "high", "xhigh"] as const) {
      expect(resolveChatGptWebContextLimits(CHATGPT_WEB_BACKEND_MODEL, effort, pro)).toEqual({
        contextWindow: 111_193,
        effectiveContextWindowPercent: 85,
        autoCompactTokenLimit: 95_000,
      });
    }
    expect(resolveChatGptWebContextLimits(CHATGPT_WEB_BACKEND_MODEL, "max", pro)).toEqual({
      contextWindow: 112_193,
      effectiveContextWindowPercent: 85,
      autoCompactTokenLimit: 95_000,
    });
    for (const effort of ["low", "medium", "high", "xhigh", "max"] as const) {
      expect(resolveChatGptWebModelContextLimits(CHATGPT_WEB_BACKEND_MODEL, effort, pro)).toEqual({
        contextWindow: 272_000,
        effectiveContextWindowPercent: 90,
        autoCompactTokenLimit: 244_800,
      });
    }
    expect(resolveChatGptWebTransportLimits(CHATGPT_WEB_BACKEND_MODEL, "low", pro)).toEqual({
      browserMessageTokenLimit: 103_000,
      browserComposerCharLimit: 545_000,
    });
    for (const effort of ["medium", "high", "xhigh"] as const) {
      expect(resolveChatGptWebTransportLimits(CHATGPT_WEB_BACKEND_MODEL, effort, pro)).toEqual({
        browserMessageTokenLimit: 103_000,
        browserComposerCharLimit: 1_045_000,
      });
    }
    expect(resolveChatGptWebTransportLimits(CHATGPT_WEB_BACKEND_MODEL, "max", pro)).toEqual({
      browserMessageTokenLimit: 104_000,
      browserComposerCharLimit: 1_635_000,
    });
  });

  test("publishes Luna's 128K ChatGPT model window while retaining checkpoint task continuity", () => {
    const free = { solAvailable: false, proAvailable: false };
    expect(resolveChatGptWebContextLimits(CHATGPT_WEB_LUNA_BACKEND_MODEL, "low", free)).toEqual({
      contextWindow: 1_050_000,
      effectiveContextWindowPercent: 100,
      autoCompactTokenLimit: 1_050_000,
    });
    expect(resolveChatGptWebModelContextLimits(CHATGPT_WEB_LUNA_BACKEND_MODEL, "low", free)).toEqual({
      contextWindow: 128_000,
      effectiveContextWindowPercent: 100,
      autoCompactTokenLimit: 128_000,
    });
  });

  test("compacts for the browser input limit without shrinking retained Sol model headroom", () => {
    expect(resolveChatGptWebContextLimits(CHATGPT_WEB_BACKEND_MODEL, "max", pro)).toEqual({
      contextWindow: 112_193,
      effectiveContextWindowPercent: 85,
      autoCompactTokenLimit: 95_000,
    });
    expect(resolveChatGptWebModelContextLimits(CHATGPT_WEB_BACKEND_MODEL, "max", pro)).toEqual({
      contextWindow: 272_000,
      effectiveContextWindowPercent: 90,
      autoCompactTokenLimit: 244_800,
    });
    expect(resolveChatGptWebContextLimits(CHATGPT_WEB_LUNA_BACKEND_MODEL, "low", {
      solAvailable: false,
      proAvailable: false,
    })).toEqual({
      contextWindow: 1_050_000,
      effectiveContextWindowPercent: 100,
      autoCompactTokenLimit: 1_050_000,
    });
  });

  test("binds the selected model authoritatively and ignores a conflicting request effort", () => {
    const request = parsed("chatgpt-web/gpt-5.6-sol", "high");
    const rawSnapshot = structuredClone(request._rawBody);
    const route = routeChatGptWebRequest(request, defaultConfig("browser-only"));

    expect(route.slug).toBe("chatgpt-web/gpt-5.6-sol");
    expect(request.modelId).toBe(CHATGPT_WEB_BACKEND_MODEL);
    expect(request.options.reasoning).toBe("high");
    expect(request._rawBody).toEqual(rawSnapshot);
  });

  test("binds the Pro model to the browser Pro effort and fails closed for unknown routes", () => {
    const config = defaultConfig("full");
    config.proAvailable = true;
    const request = parsed("chatgpt-web/gpt-5.6-sol", "max");
    expect(routeChatGptWebRequest(request, config).adapterEffort).toBe("max");
    expect(request.options.reasoning).toBe("max");
    expect(() => routeChatGptWebRequest(parsed("chatgpt-web/not-enabled"), config))
      .toThrow("model is not enabled");
  });

  test("keeps Pro compaction on the same retained Pro conversation", () => {
    const config = defaultConfig("full");
    config.proAvailable = true;
    const normal = parsed("chatgpt-web/gpt-5.6-sol", "max");
    const compact = parsed("chatgpt-web/gpt-5.6-sol", "max");
    const metadata = {
      "x-codex-turn-metadata": JSON.stringify({ thread_id: "thread_pro_compaction" }),
    };
    normal._rawBody = {
      model: "chatgpt-web/gpt-5.6-sol",
      reasoning: { effort: "max" },
      client_metadata: metadata,
    };
    compact._rawBody = structuredClone(normal._rawBody);
    compact._compactionRequest = true;

    expect(routeChatGptWebRequest(normal, config).slug).toBe("chatgpt-web/gpt-5.6-sol");
    expect(normal.options.reasoning).toBe("max");
    expect(routeChatGptWebRequest(compact, config).slug).toBe("chatgpt-web/gpt-5.6-sol");
    expect(compact.options.reasoning).toBe("max");
    expect(chatGptConversationKey(compact, "provider"))
      .toBe(chatGptConversationKey(normal, "provider"));
  });

  test("binds the Luna route to Luna without a selectable effort", () => {
    const config = defaultConfig("browser-only");
    config.solAvailable = false;
    const request = parsed("chatgpt-web/luna", "high");
    const route = routeChatGptWebRequest(request, config);
    expect(route).toBe(CHATGPT_WEB_LUNA_MODEL_ROUTE);
    expect(request.modelId).toBe(CHATGPT_WEB_LUNA_BACKEND_MODEL);
    expect(request.options.reasoning).toBe("low");
  });
});
