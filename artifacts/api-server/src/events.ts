import { EventEmitter } from "events";

export type AppEventMap = {
  "show-book.created": { showBookId: string; operationId: string };
  "show-book.updated": { showBookId: string; changeType: "STRUCTURAL" | "CONFIG"; reason: string };
  "show-book.version.created": { showBookId: string; version: number; changeType: "STRUCTURAL" | "CONFIG" };
  "agenda.event.created": { eventId: string; operationId: string; type: string; date: string };
  "agenda.event.updated": { eventId: string; changedFields: string[] };
  "agenda.event.suspended": { eventId: string; reason: string; operationId: string };
  "agenda.event.cancelled": { eventId: string; reason: string; operationId: string };
  "agenda.event.completed": { eventId: string; operationId: string };
};

class TypedEventBus extends EventEmitter {
  emit<K extends keyof AppEventMap>(event: K, payload: AppEventMap[K]): boolean {
    return super.emit(event as string, payload);
  }
  on<K extends keyof AppEventMap>(event: K, listener: (payload: AppEventMap[K]) => void): this {
    return super.on(event as string, listener);
  }
}

export const bus = new TypedEventBus();
bus.setMaxListeners(50);
