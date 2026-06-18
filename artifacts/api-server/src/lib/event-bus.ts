import { EventEmitter } from "node:events";
import type { EventName, EventPayload, EventPayloadMap } from "@workspace/shared";

class TypedEventBus extends EventEmitter {
  emit<T extends EventName>(event: T, payload: EventPayload<T>): boolean {
    return super.emit(event, payload);
  }

  on<T extends EventName>(event: T, listener: (payload: EventPayload<T>) => void): this {
    return super.on(event, listener);
  }

  once<T extends EventName>(event: T, listener: (payload: EventPayload<T>) => void): this {
    return super.once(event, listener);
  }

  off<T extends EventName>(event: T, listener: (payload: EventPayload<T>) => void): this {
    return super.off(event, listener);
  }
}

export const eventBus = new TypedEventBus();
eventBus.setMaxListeners(50);

export type { EventName, EventPayload, EventPayloadMap };
