import { EventEmitter } from 'node:events';

/** In-process domain event bus. WebSocket hub + automation engine subscribe here. */
export interface DomainEvent {
  tenantId: string;
  type: string; // e.g. shipment.status_changed
  entityType?: string;
  entityId?: string;
  payload?: Record<string, any>;
  userId?: string | null;
}

class Bus extends EventEmitter {
  publish(e: DomainEvent) {
    // Never let a listener error break the request path
    setImmediate(() => {
      try {
        this.emit('event', e);
      } catch {
        /* listeners handle their own errors */
      }
    });
  }
}
export const bus = new Bus();
bus.setMaxListeners(50);
export const publish = (e: DomainEvent) => bus.publish(e);
