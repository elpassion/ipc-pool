import ipc from "node-ipc";
import genericPool from "generic-pool";
import { Socket } from "net";

export class PoolServer<T> {
  private pool!: genericPool.Pool<T>;
  constructor(private readonly id: string) {
    ipc.config.id = id;
  }

  public async start(
    poolFactory: genericPool.Factory<T>,
    poolOptions: genericPool.Options
  ) {
    this.pool = genericPool.createPool(poolFactory, poolOptions);
    this.pool.start();

    ipc.serve(() => {
      ipc.server.on("get", async (data, socket) => {
        const resource = await this.pool.acquire();
        this.resourcesMap.set(socket, resource);
        ipc.server.emit(socket, "resource", { requestId: data, resource });
      });
      ipc.server.on("release", async (data, socket) => {
        const resource = this.resourcesMap.get(socket);
        if (!resource) return;
        this.resourcesMap.delete(socket);
        await this.pool.release(resource);
      });
      ipc.server.on("socket.disconnected", async (socket) => {
        const resource = this.resourcesMap.get(socket);
        if (!resource) return;
        this.resourcesMap.delete(socket);
        await this.pool.release(resource);
      });
    });
    ipc.server.start();
  }

  public async stop() {
    ipc.server.stop();
    await this.pool.clear();
  }

  private resourcesMap = new Map<Socket, T>();
}
