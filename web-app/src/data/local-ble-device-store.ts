import type { BleDevice } from '../ble/ble-client';

const DEVICE_STORAGE_KEY = 'bubblewalk/ble/paired_devices/v1';
const SELECTED_DEVICE_KEY = 'bubblewalk/ble/selected_device_id';

export type StoredBleDevice = BleDevice & {
  lastConnectedAt?: string;
};

export class LocalBleDeviceStore {
  loadAll(): StoredBleDevice[] {
    const raw = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as StoredBleDevice[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((device) => typeof device.id === 'string' && device.id.length > 0);
    } catch {
      return [];
    }
  }

  selectedDeviceId(): string | null {
    return window.localStorage.getItem(SELECTED_DEVICE_KEY);
  }

  saveSelectedDeviceId(deviceId: string | null): void {
    if (deviceId) {
      window.localStorage.setItem(SELECTED_DEVICE_KEY, deviceId);
    } else {
      window.localStorage.removeItem(SELECTED_DEVICE_KEY);
    }
  }

  remember(device: BleDevice, patch: Partial<Omit<StoredBleDevice, keyof BleDevice>> = {}): StoredBleDevice {
    const devices = this.loadAll();
    const existing = devices.find((item) => item.id === device.id);
    const next: StoredBleDevice = {
      ...existing,
      ...device,
      name: device.name ?? existing?.name,
      ...patch,
    };
    const merged = [next, ...devices.filter((item) => item.id !== device.id)];
    this.saveAll(merged);
    return next;
  }

  forget(deviceId: string): void {
    const remaining = this.loadAll().filter((device) => device.id !== deviceId);
    this.saveAll(remaining);
    if (this.selectedDeviceId() === deviceId) {
      this.saveSelectedDeviceId(null);
    }
  }

  private saveAll(devices: StoredBleDevice[]): void {
    window.localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(devices));
  }
}
