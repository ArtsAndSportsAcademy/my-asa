import { useListMessageThreads } from "@workspace/api-client-react";

export function useUnreadMessagesCount(): number {
  const { data } = useListMessageThreads();
  if (!data?.threads) return 0;
  return (data.threads as Array<{ unreadCount?: number }>).reduce(
    (sum, t) => sum + (t.unreadCount ?? 0),
    0,
  );
}
