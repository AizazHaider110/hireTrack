import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from './event-bus.service';

describe('EventBusService', () => {
  let service: EventBusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBusService],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should publish and receive events', (done) => {
    const eventType = 'test.event';
    const payload = { message: 'Hello World' };

    service.subscribe(eventType, (event) => {
      expect(event.type).toBe(eventType);
      expect(event.payload).toEqual(payload);
      expect(event.timestamp).toBeInstanceOf(Date);
      done();
    });

    service.publish(eventType, payload);
  });

  it('should handle multiple subscribers', () => {
    const eventType = 'test.multiple';
    const payload = { count: 1 };
    let callCount = 0;

    service.subscribe(eventType, () => {
      callCount++;
    });

    service.subscribe(eventType, () => {
      callCount++;
    });

    service.publish(eventType, payload);

    expect(callCount).toBe(2);
  });

  it('should include metadata in events', (done) => {
    const eventType = 'test.metadata';
    const payload = { data: 'test' };
    const metadata = { userId: '123', source: 'test' };

    service.subscribe(eventType, (event) => {
      expect(event.metadata).toEqual(metadata);
      done();
    });

    service.publish(eventType, payload, metadata);
  });

  it('should handle async event handlers', async () => {
    const eventType = 'test.async';
    const payload = { value: 42 };
    let processed = false;

    service.subscribe(eventType, async (event) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      processed = true;
    });

    service.publish(eventType, payload);

    // Wait for async handler to complete
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(processed).toBe(true);
  });

  it('should unsubscribe from events', () => {
    const eventType = 'test.unsubscribe';
    const payload = { data: 'test' };
    let callCount = 0;

    const handler = () => {
      callCount++;
    };

    service.subscribe(eventType, handler);
    service.publish(eventType, payload);
    expect(callCount).toBe(1);

    service.unsubscribe(eventType, handler);
    service.publish(eventType, payload);
    expect(callCount).toBe(1); // Should not increment
  });
});
