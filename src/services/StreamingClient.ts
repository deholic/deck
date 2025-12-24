import type { Account, Status } from "../domain/types";

export type StreamingEvent =
  | { type: "update"; status: Status }
  | { type: "delete"; id: string }
  | { type: "notification" };

export interface StreamingClient {
  connect(account: Account, onEvent: (event: StreamingEvent) => void): () => void;
}
