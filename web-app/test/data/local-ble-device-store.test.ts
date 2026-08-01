import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBleDeviceStore } from '../../src/data/local-ble-device-store';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('LocalBleDeviceStore', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
  });

  it('remembers devices without automatically selecting one', () => {
    const store = new LocalBleDeviceStore();

    store.remember({ id: 'participant-4', name: 'PB-participant-4' });
    store.remember({ id: 'participant-5', name: 'PB-participant-5' });

    expect(store.loadAll().map((device) => device.name)).toEqual(['PB-participant-5', 'PB-participant-4']);
    expect(store.selectedDeviceId()).toBeNull();
  });

  it('does not select a fallback device after forgetting the selected one', () => {
    const store = new LocalBleDeviceStore();

    store.remember({ id: 'participant-4', name: 'PB-participant-4' });
    store.remember({ id: 'participant-5', name: 'PB-participant-5' });
    store.saveSelectedDeviceId('participant-4');

    store.forget('participant-4');

    expect(store.loadAll().map((device) => device.name)).toEqual(['PB-participant-5']);
    expect(store.selectedDeviceId()).toBeNull();
  });
});
