import type { Account } from "../domain/types";
import type { StreamingClient } from "../services/StreamingClient";

export class UnifiedStreamingClient implements StreamingClient {
  constructor(
    private readonly mastodon: StreamingClient,
    private readonly misskey: StreamingClient
  ) {}

  connect(account: Account, onEvent: Parameters<StreamingClient["connect"]>[1]): () => void {
    if (account.platform === "misskey") {
      return this.misskey.connect(account, onEvent);
    }
    return this.mastodon.connect(account, onEvent);
  }
}
