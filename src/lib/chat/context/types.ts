/** Internal server envelope. Deliberately absent from the public ChatInputSchema. */
export interface ConversationRecall {
  context: string;
  sourceIds: string[];
  status: "available" | "empty" | "unavailable";
  totalTurns: number;
  includedTurns: number;
  partial: boolean;
  period: { startDay: string; endDay: string; label: string } | null;
}
