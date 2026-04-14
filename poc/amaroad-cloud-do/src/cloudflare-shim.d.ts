declare module "cloudflare:workers" {
  export class DurableObject<Env = unknown> {
    protected readonly ctx: DurableObjectState;
    protected readonly env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}

declare global {
  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }

  interface ResponseInit {
    webSocket?: WebSocket | null;
  }

  interface WebSocket {
    serializeAttachment(value: unknown): void;
    deserializeAttachment(): unknown;
  }

  class WebSocketPair {
    0: WebSocket;
    1: WebSocket;
  }

  interface DurableObjectStorage {
    setAlarm(scheduledTime: number | Date): Promise<void>;
    getAlarm(): Promise<number | null>;
  }

  interface DurableObjectState {
    storage: DurableObjectStorage;
    acceptWebSocket(ws: WebSocket, tags?: string[]): void;
    getWebSockets(tag?: string): WebSocket[];
  }

  interface DurableObjectId {}

  interface DurableObjectStub {
    fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
  }

  interface DurableObjectNamespace {
    idFromName(name: string): DurableObjectId;
    get(id: DurableObjectId): DurableObjectStub;
  }

  interface ExportedHandler<Env = unknown> {
    fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>;
  }
}

export {};
