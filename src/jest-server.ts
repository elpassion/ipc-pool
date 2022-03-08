import { PoolServer } from "./server";

export class JestServer<T> extends PoolServer<T> {
  constructor(id: string) {
    super(id);
    // @ts-ignore
    global.__POOL_SERVER__ = this;
  }

  public static async stop() {
    // @ts-ignore
    await global.__POOL_SERVER__.stop();
  }
}
