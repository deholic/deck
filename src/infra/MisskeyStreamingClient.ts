import type { Account } from "../domain/types";
import type { StreamingClient, StreamingEvent } from "../services/StreamingClient";

export class MisskeyStreamingClient implements StreamingClient {
  connect(_account: Account, _onEvent: (event: StreamingEvent) => void): () => void {
    return () => {};
  }
}
