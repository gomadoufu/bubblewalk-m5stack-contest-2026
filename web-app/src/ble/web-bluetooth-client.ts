import type { BleCapability, BleClient, BleDevice, BleReadOptions, BleWriteOptions } from './ble-client';

const DEFAULT_BLE_OPERATION_TIMEOUT_MS = 8000;

type BluetoothNavigator = Navigator & {
  bluetooth?: {
    getDevices?(): Promise<WebBluetoothDevice[]>;
    requestDevice(options: {
      filters: Array<{ services: string[] }>;
      optionalServices: string[];
    }): Promise<WebBluetoothDevice>;
  };
};

type WebBluetoothDevice = {
  id: string;
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<WebBluetoothServer>;
    disconnect(): void;
  };
};

type WebBluetoothServer = {
  getPrimaryService(serviceUuid: string): Promise<WebBluetoothService>;
};

type WebBluetoothService = {
  getCharacteristic(characteristicUuid: string): Promise<WebBluetoothCharacteristic>;
};

type WebBluetoothCharacteristic = {
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithResponse?(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
};

export class WebBluetoothClient implements BleClient {
  private device: WebBluetoothDevice | null = null;
  private service: WebBluetoothService | null = null;
  private readonly devicesById = new Map<string, WebBluetoothDevice>();

  capability(): BleCapability {
    const bluetooth = (navigator as BluetoothNavigator).bluetooth;
    if (!window.isSecureContext) {
      return {
        available: false,
        reason: 'insecure_context',
        message: 'Open BubbleWalk over HTTPS or localhost to connect a device.',
        canRememberDevices: false,
      };
    }
    if (!bluetooth) {
      return {
        available: false,
        reason: 'missing_api',
        message: 'This browser cannot use Web Bluetooth. On iPhone, open this page in Bluefy.',
        canRememberDevices: false,
      };
    }
    return {
      available: true,
      reason: 'available',
      message: 'Web Bluetooth is ready.',
      canRememberDevices: typeof bluetooth.getDevices === 'function',
    };
  }

  async listPairedBubbleWalkDevices(_serviceUuid: string): Promise<BleDevice[]> {
    const bluetooth = (navigator as BluetoothNavigator).bluetooth;
    if (!bluetooth?.getDevices) {
      return [];
    }
    const devices = await bluetooth.getDevices();
    devices.forEach((device) => this.devicesById.set(device.id, device));
    return devices.map((device) => ({
      id: device.id,
      name: device.name,
    }));
  }

  async requestBubbleWalkDevice(serviceUuid: string): Promise<BleDevice> {
    const bluetooth = (navigator as BluetoothNavigator).bluetooth;
    if (!bluetooth) {
      throw new Error('Web Bluetooth API is unavailable');
    }
    this.device = await bluetooth.requestDevice({
      filters: [{ services: [serviceUuid] }],
      optionalServices: [serviceUuid],
    });
    this.devicesById.set(this.device.id, this.device);
    return {
      id: this.device.id,
      name: this.device.name,
    };
  }

  async connect(device: BleDevice, serviceUuid: string): Promise<void> {
    if (this.device?.id === device.id && this.device.gatt?.connected && this.service) {
      return;
    }
    this.device = await this.resolveDevice(device);
    if (!this.device.gatt) throw new Error('Selected BLE device has no GATT server');
    this.service = null;
    const server = await withTimeout(
      this.device.gatt.connect(),
      DEFAULT_BLE_OPERATION_TIMEOUT_MS,
      `ble_connect_timeout:${device.id}`,
    );
    this.service = await withTimeout(
      server.getPrimaryService(serviceUuid),
      DEFAULT_BLE_OPERATION_TIMEOUT_MS,
      `ble_service_timeout:${serviceUuid}`,
    );
  }

  async readCharacteristic(characteristicUuid: string, options: BleReadOptions = {}): Promise<DataView> {
    const characteristic = await this.characteristic(characteristicUuid);
    return withTimeout(
      characteristic.readValue(),
      options.timeoutMs ?? DEFAULT_BLE_OPERATION_TIMEOUT_MS,
      `ble_read_timeout:${characteristicUuid}`,
    );
  }

  async writeCharacteristic(
    characteristicUuid: string,
    value: Uint8Array,
    options: BleWriteOptions = {},
  ): Promise<void> {
    const characteristic = await this.characteristic(characteristicUuid);
    const payload = value.slice().buffer as ArrayBuffer;
    const response = options.response ?? 'auto';
    let operation: Promise<void>;

    if (response === 'without' && characteristic.writeValueWithoutResponse) {
      operation = characteristic.writeValueWithoutResponse(payload);
    } else if (response === 'with' && characteristic.writeValueWithResponse) {
      operation = characteristic.writeValueWithResponse(payload);
    } else if (response === 'auto' && characteristic.writeValueWithResponse) {
      operation = characteristic.writeValueWithResponse(payload);
    } else {
      operation = characteristic.writeValue(payload);
    }

    await withTimeout(
      operation,
      options.timeoutMs ?? DEFAULT_BLE_OPERATION_TIMEOUT_MS,
      `ble_write_timeout:${characteristicUuid}`,
    );
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.service = null;
  }

  private async characteristic(characteristicUuid: string): Promise<WebBluetoothCharacteristic> {
    if (!this.service) throw new Error('BLE service is not connected');
    return withTimeout(
      this.service.getCharacteristic(characteristicUuid),
      DEFAULT_BLE_OPERATION_TIMEOUT_MS,
      `ble_characteristic_timeout:${characteristicUuid}`,
    );
  }

  private async resolveDevice(device: BleDevice): Promise<WebBluetoothDevice> {
    const cached = this.devicesById.get(device.id);
    if (cached) return cached;
    if (this.device?.id === device.id) return this.device;

    await this.listPairedBubbleWalkDevices('');
    const restored = this.devicesById.get(device.id);
    if (restored) return restored;

    throw new Error('selected_device_unavailable');
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof window.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });
}
