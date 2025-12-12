import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface SystemEvent {
  type: string;
  payload: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
    // Increase max listeners to prevent warnings in high-throughput scenarios
    this.eventEmitter.setMaxListeners(100);
  }

  /**
   * Publish an event to the internal event bus
   */
  publish(
    eventType: string,
    payload: any,
    metadata?: Record<string, any>,
  ): void {
    const event: SystemEvent = {
      type: eventType,
      payload,
      timestamp: new Date(),
      metadata,
    };

    this.logger.debug(`Publishing event: ${eventType}`, { payload, metadata });
    this.eventEmitter.emit(eventType, event);
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe(
    eventType: string,
    handler: (event: SystemEvent) => void | Promise<void>,
  ): void {
    this.logger.debug(`Subscribing to event: ${eventType}`);

    // Create a wrapper that handles both sync and async handlers
    const wrappedHandler = async (event: SystemEvent) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error handling event ${eventType}:`, error);
      }
    };

    // Store the mapping between original handler and wrapped handler
    // This allows proper unsubscription
    if (!(handler as any).__wrappedHandler) {
      (handler as any).__wrappedHandler = wrappedHandler;
    }

    this.eventEmitter.on(eventType, (handler as any).__wrappedHandler);
  }

  /**
   * Subscribe to events matching a pattern
   */
  subscribePattern(
    pattern: RegExp,
    handler: (event: SystemEvent) => void | Promise<void>,
  ): void {
    this.logger.debug(`Subscribing to event pattern: ${pattern}`);

    // Listen to all events and filter by pattern
    const originalEmit = this.eventEmitter.emit.bind(this.eventEmitter);
    this.eventEmitter.emit = function (eventType: string, ...args: any[]) {
      if (pattern.test(eventType)) {
        const result = handler(args[0] as SystemEvent);
        if (result && typeof result.catch === 'function') {
          result.catch((error) => {
            Logger.error(`Error handling pattern event ${eventType}:`, error);
          });
        }
      }
      return originalEmit(eventType, ...args);
    };
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(eventType: string, handler: (event: SystemEvent) => void): void {
    // Use the wrapped handler if it exists
    const wrappedHandler = (handler as any).__wrappedHandler || handler;
    this.eventEmitter.off(eventType, wrappedHandler);
  }

  /**
   * Remove all listeners for an event type
   */
  removeAllListeners(eventType?: string): void {
    this.eventEmitter.removeAllListeners(eventType);
  }
}
