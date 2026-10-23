/**
 * Request epochs.
 *
 * Comparing a session or page string before and after an await is not enough:
 * an account that goes A -> B -> A, or a bill that goes A -> B -> A, compares
 * equal at the end even though the user's context changed in between. An epoch
 * is a counter that only ever increases. Every change bumps it synchronously,
 * so a token captured before the change can never become live again.
 *
 * Three independent epochs make up a request token:
 *  - wallet: bumped on every wallet event (account, chain, connector, connect,
 *            disconnect), from the provider itself and from wagmi's state;
 *  - page:   bumped on every navigation (network, contract, bill);
 *  - op:     bumped when a new request begins and when the owner unmounts.
 */

export class EpochCounter {
  private n = 0
  get value(): number {
    return this.n
  }
  bump(): number {
    this.n += 1
    return this.n
  }
}

export interface EpochSources {
  wallet: EpochCounter
  page: EpochCounter
}

/** Process-wide epochs used by the app. Tests build their own instances. */
export const appEpochs: EpochSources = {
  wallet: new EpochCounter(),
  page: new EpochCounter(),
}

export interface LiveCheck {
  isLive(): boolean
}

export class RequestToken implements LiveCheck {
  private readonly wallet: number
  private readonly page: number
  private readonly opAtStart: number
  constructor(
    private readonly sources: EpochSources,
    private readonly op: EpochCounter,
  ) {
    this.wallet = sources.wallet.value
    this.page = sources.page.value
    this.opAtStart = op.value
  }
  /**
   * True while the owning component still wants this request's outcome
   * (not superseded, not unmounted). Wallet or page changes do not affect it,
   * so the owner can still tell the user about a transaction that was sent.
   */
  ownerActive(): boolean {
    return this.op.value === this.opAtStart
  }
  isLive(): boolean {
    return (
      this.sources.wallet.value === this.wallet &&
      this.sources.page.value === this.page &&
      this.op.value === this.opAtStart
    )
  }
}

/**
 * Owned by one component instance. `begin()` supersedes every earlier token of
 * this scope; `dispose()` (unmount) invalidates all of them.
 */
export class RequestScope {
  private readonly op = new EpochCounter()
  constructor(private readonly sources: EpochSources = appEpochs) {}
  begin(): RequestToken {
    this.op.bump()
    return new RequestToken(this.sources, this.op)
  }
  /** A token that does not supersede earlier ones (for read-only follow-ups). */
  snapshot(): RequestToken {
    return new RequestToken(this.sources, this.op)
  }
  dispose(): void {
    this.op.bump()
  }
}
