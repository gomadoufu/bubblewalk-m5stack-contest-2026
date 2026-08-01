export type BleDevice = {
  id: string;
  name?: string;
};

export type BleCapability = {
  available: boolean;
  reason: 'available' | 'missing_api' | 'insecure_context';
  message: string;
  canRememberDevices: boolean;
};

export type BleReadOptions = {
  timeoutMs?: number;
};

export type BleWriteOptions = {
  response?: 'with' | 'without' | 'auto';
  timeoutMs?: number;
};

export type BleClient = {
  capability(): BleCapability;
  listPairedBubbleWalkDevices(serviceUuid: string): Promise<BleDevice[]>;
  requestBubbleWalkDevice(serviceUuid: string): Promise<BleDevice>;
  connect(device: BleDevice, serviceUuid: string): Promise<void>;
  readCharacteristic(characteristicUuid: string, options?: BleReadOptions): Promise<DataView>;
  writeCharacteristic(characteristicUuid: string, value: Uint8Array, options?: BleWriteOptions): Promise<void>;
  disconnect(): Promise<void>;
};
