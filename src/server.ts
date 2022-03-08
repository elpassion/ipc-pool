import ipc from "node-ipc";
import genericPool from "generic-pool";
import { Socket } from "net";

export class PoolServer<T> {
  private pool!: genericPool.Pool<T>;
  private serializeResource: (resource: T) => any;

  constructor(
    private readonly id: string,
    private readonly config: {
      factory: genericPool.Factory<T>;
      opts: genericPool.Options;
      serializeResource?: (resource: T) => any;
    }
  ) {
    this.serializeResource =
      this.config.serializeResource || ((resource: T) => resource);
    ipc.config.id = this.id;
  }

  public async start() {
    this.pool = genericPool.createPool(this.config.factory, this.config.opts);
    this.pool.start();

    ipc.serve(() => {
      ipc.server.on("get", async (requestId: string, socket: Socket) => {
        const serializedResource = await this.acquireSerializedResource();
        this.socketsToResourcesMap.set(socket, [
          ...(this.socketsToResourcesMap.get(socket) || []),
          serializedResource,
        ]);
        ipc.server.emit(socket, "resource", {
          requestId,
          resource: serializedResource,
        });
      });
      ipc.server.on(
        "release",
        async (serializedResource: any, socket: Socket) => {
          const resource =
            this.serializedResourcesToResourcesMap.get(serializedResource);
          if (!resource) return;
          this.serializedResourcesToResourcesMap.delete(serializedResource);
          this.socketsToResourcesMap.set(
            socket,
            (this.socketsToResourcesMap.get(socket) || ([] as T[])).filter(
              (socketResource) => resource === socketResource
            )
          );
          await this.pool.release(resource);
        }
      );
      ipc.server.on("socket.disconnected", async (socket: Socket) => {
        const serializedResources = this.socketsToResourcesMap.get(socket);
        if (!serializedResources) return;
        this.socketsToResourcesMap.delete(socket);
        await Promise.all(
          serializedResources.map(async (serializedResource) => {
            const resource =
              this.serializedResourcesToResourcesMap.get(serializedResource);
            if (!resource) return;
            await this.pool.release(resource);
          })
        );
      });
    });
    ipc.server.start();
  }

  public async stop() {
    ipc.server.stop();
    await this.pool.clear();
  }

  private async acquireSerializedResource() {
    const resource = await this.pool.acquire();
    const serializedResource = this.serializeResource(resource);

    this.serializedResourcesToResourcesMap.set(serializedResource, resource);

    return serializedResource;
  }

  private socketsToResourcesMap = new Map<Socket, T[]>();
  private serializedResourcesToResourcesMap = new Map<any, T>();
}
