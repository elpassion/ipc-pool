import ipc from "node-ipc";

export class PoolClient<T> {
  private constructor(private readonly id: string) {}

  public static async connect(id: string) {
    const client = new PoolClient(id);
    await client.connectSocket();
    return client;
  }

  public async get(): Promise<T> {
    return await new Promise((resolve) => {
      const requestId = Math.random();
      ipc.of[this.id].emit("get", requestId);
      this.requestsMap.set(requestId, (resource: T) => resolve(resource));
    });
  }

  public async release(resource: T): Promise<undefined> {
    return await new Promise((resolve) => {
      ipc.of[this.id].emit("release", resource);
      resolve(undefined);
    });
  }

  private async connectSocket() {
    return await new Promise((resolve) => {
      ipc.connectTo(this.id, () => {
        ipc.of[this.id].on(
          "resource",
          (data: { requestId: number; resource: T }) => {
            const resolve = this.requestsMap.get(data.requestId);
            if (!resolve) return;
            resolve(data.resource);
          }
        );
        resolve(undefined);
      });
    });
  }

  private requestsMap = new Map();
}
