export interface ChatGptWebAdapterErrorOptions {
  status: number;
  errorType: string;
  code: string;
  retryable: boolean;
}

export class ChatGptWebAdapterError extends Error {
  readonly status: number;
  readonly errorType: string;
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, options: ChatGptWebAdapterErrorOptions) {
    super(message);
    this.name = "ChatGptWebAdapterError";
    this.status = options.status;
    this.errorType = options.errorType;
    this.code = options.code;
    this.retryable = options.retryable;
  }
}

/** Internal pre-submit signal: one compiled browser message exceeded ChatGPT's product boundary. */
export const CHATGPT_BROWSER_INPUT_LIMIT_ERROR_CODE = "chatgpt_browser_input_limit";

export function chatGptBrowserInputLimitError(message: string): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(message, {
    status: 400,
    errorType: "invalid_request_error",
    code: CHATGPT_BROWSER_INPUT_LIMIT_ERROR_CODE,
    retryable: false,
  });
}

export function isChatGptBrowserInputLimitError(error: unknown): error is ChatGptWebAdapterError {
  return error instanceof ChatGptWebAdapterError
    && error.code === CHATGPT_BROWSER_INPUT_LIMIT_ERROR_CODE;
}

export function chatGptBrowserTabClosedError(): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(
    "The ChatGPT browser tab was closed, so the Codex turn was cancelled.",
    {
      status: 499,
      errorType: "client_closed_request",
      code: "client_cancelled",
      retryable: false,
    },
  );
}

export function chatGptStoppedThinkingError(): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(
    "ChatGPT remained in 'Stopped thinking' for 5 seconds, so the Codex turn was cancelled.",
    {
      status: 499,
      errorType: "client_closed_request",
      code: "client_cancelled",
      retryable: false,
    },
  );
}

export function chatGptRetainedConversationUnavailableError(): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(
    "The retained ChatGPT conversation is no longer available.",
    {
      status: 409,
      errorType: "invalid_request_error",
      code: "compaction_source_unavailable",
      retryable: false,
    },
  );
}
