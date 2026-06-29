import type { DailyBook } from "@workspace/api-client-react";

export interface DailyBookGroup {
  operationId: string;
  operationName: string;
  items: DailyBook[];
}

/** Rótulo legível do Livro do Dia: nome do show, senão título do evento, senão fallback. */
export function dailyBookLabel(book: DailyBook): string {
  return book.showTitle || book.eventTitle || `Evento ${book.agendaEventId.slice(0, 8)}`;
}

/** Agrupa os Livros do Dia por operação, ordenados por nome (pt-BR). */
export function groupDailyBooksByOperation(books: DailyBook[]): DailyBookGroup[] {
  const map = new Map<string, DailyBookGroup>();
  for (const b of books) {
    const key = b.operationId ?? "__none__";
    const operationName = b.operationName ?? "Sem operação";
    if (!map.has(key)) map.set(key, { operationId: key, operationName, items: [] });
    map.get(key)!.items.push(b);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.operationName.localeCompare(b.operationName, "pt-BR"),
  );
}
