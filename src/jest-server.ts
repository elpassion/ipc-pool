import { Factory, Options } from "generic-pool";
import { PoolServer } from "./server";

export class JestServer<T> extends PoolServer<T> {
  public static async start<T>(
    id: string,
    poolFactory: Factory<T>,
    poolOptions: Options
  ) {
    const server = new JestServer<T>(id);
    // @ts-ignore
    global.__POOL_SERVER__ = server;
    await server.start(poolFactory, poolOptions);
  }

  public static async stop() {
    // @ts-ignore
    await global.__POOL_SERVER__.stop();
  }
}
