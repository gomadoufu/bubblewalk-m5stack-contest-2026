#include <Arduino.h>
#include <Preferences.h>
#include <driver/gpio.h>
#include <esp_mac.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER) || defined(ROLE_PARTICIPANT)
#include <BLEAdvertisedDevice.h>
#include <BLEAdvertising.h>
#include <BLECharacteristic.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEServer.h>
#include <BLEService.h>
#include <BLEUtils.h>
#endif

#include "bubblewalk/byte_codec.h"
#include "bubblewalk/color.h"
#include "bubblewalk/neohex_display.h"
#include "bubblewalk/status_led.h"

using bubblewalk::EncounterDisplayUpdate;
using bubblewalk::NeohexDisplay;
using bubblewalk::RgbColor;
using bubblewalk::StatusLed;
using bubblewalk::blendRgb;
using bubblewalk::byteFromFloat;
using bubblewalk::crc16CcittFalse;
using bubblewalk::readLe16;
using bubblewalk::readLe32;
using bubblewalk::triangleRgb;
using bubblewalk::writeLe16;
using bubblewalk::writeLe32;

#ifndef DEFAULT_OPINION_VALUE
#define DEFAULT_OPINION_VALUE 128
#endif

#ifndef TOPIC_ID_HASH
#define TOPIC_ID_HASH 0x20260801UL
#endif

#ifndef TOPIC_VERSION
#define TOPIC_VERSION 3
#endif

#ifndef TOPIC_LEFT_RGB
#define TOPIC_LEFT_RGB 0x12CFEEUL
#endif

#ifndef TOPIC_RIGHT_RGB
#define TOPIC_RIGHT_RGB 0xFF4FA7UL
#endif

#ifndef HISTOGRAM_BINS
#define HISTOGRAM_BINS 16
#endif

#ifndef RETENTION_MINUTES
#define RETENTION_MINUTES 15
#endif

#ifndef DEDUP_WINDOW_MS
#define DEDUP_WINDOW_MS 3000UL
#endif

#ifndef UNIQUE_PEER_CAPACITY
#define UNIQUE_PEER_CAPACITY 32
#endif

#ifndef ENCOUNTER_SAMPLE_CAPACITY
#define ENCOUNTER_SAMPLE_CAPACITY 16
#endif

#ifndef SYNC_WINDOW_TIMEOUT_MS
#define SYNC_WINDOW_TIMEOUT_MS 60000UL
#endif

#ifndef BLE_PAYLOAD_UPDATE_MS
#define BLE_PAYLOAD_UPDATE_MS 1000UL
#endif

#ifndef PARTICIPANT_ADV_WINDOW_MS
#define PARTICIPANT_ADV_WINDOW_MS 1200UL
#endif

#ifndef PARTICIPANT_SCAN_WINDOW_MS
#define PARTICIPANT_SCAN_WINDOW_MS 1200UL
#endif

#ifndef PARTICIPANT_PHASE_JITTER_MS
#define PARTICIPANT_PHASE_JITTER_MS 500UL
#endif

#ifndef NEOHEX_ENCOUNTER_RSSI_NEAR_DBM
#define NEOHEX_ENCOUNTER_RSSI_NEAR_DBM -55
#endif

#ifndef NEOHEX_ENCOUNTER_RSSI_MIDDLE_DBM
#define NEOHEX_ENCOUNTER_RSSI_MIDDLE_DBM -70
#endif

#ifndef ENABLE_FLASH_HISTOGRAM_SNAPSHOT
#define ENABLE_FLASH_HISTOGRAM_SNAPSHOT 1
#endif

#ifndef FLASH_HISTOGRAM_SNAPSHOT_INTERVAL_MS
#define FLASH_HISTOGRAM_SNAPSHOT_INTERVAL_MS 5000UL
#endif

#ifndef NEOHEX_PIN
#define NEOHEX_PIN 2
#endif

#ifndef NEOHEX_COUNT
#define NEOHEX_COUNT 37
#endif

#ifndef NEOHEX_BRIGHTNESS
#define NEOHEX_BRIGHTNESS 24
#endif

#ifndef NANO_H2_BLUE_LED_PIN
#define NANO_H2_BLUE_LED_PIN 4
#endif

#ifndef NANO_H2_BUTTON_PIN
#define NANO_H2_BUTTON_PIN 9
#endif

#ifndef NANO_H2_RGB_POWER_PIN
#define NANO_H2_RGB_POWER_PIN 10
#endif

#ifndef NANO_H2_RGB_DATA_PIN
#define NANO_H2_RGB_DATA_PIN 11
#endif

#if defined(ROLE_PARTICIPANT)
#ifndef ROLE_ADVERTISER
#define ROLE_ADVERTISER 1
#endif
#ifndef ROLE_SCANNER
#define ROLE_SCANNER 1
#endif
#endif

#if defined(ROLE_ADVERTISER) && defined(ROLE_SCANNER)
#define ROLE_IS_PARTICIPANT 1
#else
#define ROLE_IS_PARTICIPANT 0
#endif

struct __attribute__((packed)) EncounterPayload {
  uint16_t companyId;
  uint16_t magic;
  uint8_t version;
  uint8_t nodeId;
  uint32_t topicIdHash;
  uint8_t opinionValue;
  uint16_t seq;
  uint8_t triangleX;
  uint8_t triangleY;
  uint8_t reserved;
};

struct HistogramState {
  uint16_t bins[16];
  uint16_t uniquePeerCount;
  uint16_t packetCount;
  uint16_t rawPacketCount;
  uint16_t duplicatePacketCount;
  uint32_t firstSeenMillis;
  uint32_t lastSeenMillis;
  bool overflow;
};

struct PeerObservation {
  uint8_t nodeId;
  uint8_t opinionValue;
  uint8_t triangleX;
  uint8_t triangleY;
  uint8_t binIndex;
  uint16_t packetCount;
  uint32_t lastSeenMillis;
  int8_t lastRssi;
  uint16_t lastSeq;
  bool valid;
};

struct DedupEntry {
  uint8_t nodeId;
  uint16_t seq;
  uint32_t topicIdHash;
  uint32_t lastSeenMillis;
  bool valid;
};

struct EncounterSample {
  uint8_t nodeId;
  uint8_t opinionValue;
  uint8_t binIndex;
  int8_t rssi;
  uint16_t seq;
  uint8_t triangleX;
  uint8_t triangleY;
  uint32_t seenMillis;
  bool valid;
};

struct __attribute__((packed)) FlashPeerObservation {
  uint8_t valid;
  uint8_t nodeId;
  uint8_t opinionValue;
  uint8_t triangleX;
  uint8_t triangleY;
  uint8_t binIndex;
  uint16_t packetCount;
  int8_t lastRssi;
  uint16_t lastSeq;
  uint16_t ageSeconds;
};

struct __attribute__((packed)) FlashEncounterSample {
  uint8_t valid;
  uint8_t nodeId;
  uint8_t opinionValue;
  uint8_t binIndex;
  int8_t rssi;
  uint16_t seq;
  uint8_t triangleX;
  uint8_t triangleY;
  uint16_t ageSeconds;
};

enum BubbleWalkError : uint8_t {
  NoError = 0,
  InvalidLength = 1,
  CrcMismatch = 2,
  UnsupportedLayoutVersion = 3,
  TopicMismatch = 4,
  InvalidOpinionValue = 5,
  UnsupportedHistogramBins = 6,
  UnknownCommand = 7,
  MtuOrChunkRequired = 8,
  BleOperationFailed = 9,
};

enum ParticipantBleMode : uint8_t {
  ParticipantBleIdle = 0,
  ParticipantBleAdvertising = 1,
  ParticipantBleScanning = 2,
};

enum TopicSelectionMode : uint8_t {
  TopicSelectionContinuous = 0,
  TopicSelectionChoice3 = 1,
  TopicSelectionTriangle = 2,
};

static constexpr uint8_t kFirmwareMajor = 0;
static constexpr uint8_t kFirmwareMinor = 5;
static constexpr uint8_t kFirmwarePatch = 1;
static constexpr uint8_t kLayoutVersion = 1;
static constexpr uint8_t kProtocolVersion = 2;
static constexpr uint16_t kCompanyId = 0xFFFF;
static constexpr uint16_t kMagic = 0x4250;
static constexpr uint8_t kPayloadVersionV1 = 1;
static constexpr uint8_t kPayloadVersion = 2;
static constexpr uint8_t kMaxHistogramBins = 16;
static constexpr uint8_t kHistogramCounterWidth = 2;
static constexpr uint8_t kHistogramBinCountDefault = (HISTOGRAM_BINS == 16) ? 16 : 8;
static constexpr uint8_t kDedupCacheSize = 16;
static constexpr uint8_t kUniquePeerCapacity =
    (UNIQUE_PEER_CAPACITY < 1)
        ? 1
        : ((UNIQUE_PEER_CAPACITY > 255)
               ? 255
               : static_cast<uint8_t>(UNIQUE_PEER_CAPACITY));
static constexpr uint8_t kEncounterSampleCapacity =
    (ENCOUNTER_SAMPLE_CAPACITY < 1)
        ? 1
        : ((ENCOUNTER_SAMPLE_CAPACITY > 32)
               ? 32
               : static_cast<uint8_t>(ENCOUNTER_SAMPLE_CAPACITY));
static constexpr uint8_t kDeviceStatusLength = 32;
static constexpr uint8_t kTopicConfigLengthV1 = 20;
static constexpr uint8_t kTopicConfigLength = 32;
static constexpr uint8_t kOpinionValueLengthV1 = 10;
static constexpr uint8_t kOpinionValueLength = 12;
static constexpr uint8_t kCommandLength = 4;
static constexpr uint8_t kHistogramHeaderLength = 21;
static constexpr uint8_t kMaxHistogramPayloadLength = kHistogramHeaderLength + kMaxHistogramBins * 2;
static constexpr uint8_t kEncounterSamplesHeaderLength = 14;
static constexpr uint8_t kEncounterSampleEntryLength = 10;
static constexpr uint8_t kMaxEncounterSamplesPayloadLength =
    kEncounterSamplesHeaderLength + kEncounterSampleCapacity * kEncounterSampleEntryLength;
static constexpr uint32_t kFlashHistogramSnapshotMagic = 0x4E485331UL;
static constexpr uint8_t kFlashHistogramSnapshotVersion = 1;
static constexpr uint32_t kButtonDebounceMs = 30;
static constexpr uint32_t kButtonMinPressMs = 80;
static constexpr uint32_t kButtonLongPressMs = 1000;
static constexpr uint32_t kButtonResetPressMs = 5000;
static constexpr uint32_t kButtonIsrMinEdgeMs = 5;
static constexpr uint8_t kButtonEdgeQueueSize = 16;
static constexpr uint32_t kSerialTxTimeoutMs = 1;
static constexpr size_t kSerialTxBufferSize = 1024;
static constexpr uint32_t kSyncOpinionDisconnectDelayMs = 300;
static constexpr uint8_t kZeroNodeIdFallback = 255;
static constexpr uint8_t kMinDeviceNumber = 1;
static constexpr uint8_t kMaxDeviceNumber = 7;
static constexpr uint8_t kDeviceNumberDisplayMinBrightness = 64;

static const RgbColor kStatusLedResetColor = {255, 255, 255};
static const RgbColor kDeviceNumberColor = {255, 255, 255};

static const char *const kGattServiceUuid = "b0052026-0000-4b42-8051-504250000000";
static const char *const kTopicConfigUuid = "b0052026-0001-4b42-8051-504250000000";
static const char *const kOpinionValueUuid = "b0052026-0002-4b42-8051-504250000000";
static const char *const kDeviceStatusUuid = "b0052026-0003-4b42-8051-504250000000";
static const char *const kHistogramUuid = "b0052026-0004-4b42-8051-504250000000";
static const char *const kCommandUuid = "b0052026-0005-4b42-8051-504250000000";
static const char *const kEncounterSamplesUuid = "b0052026-0006-4b42-8051-504250000000";
static const char *const kFlashSnapshotNamespace = "bubblewalk";
static const char *const kFlashSnapshotKey = "hist";
static const char *const kDeviceNumberKey = "device_no";

struct __attribute__((packed)) FlashHistogramSnapshot {
  uint32_t magic;
  uint16_t length;
  uint8_t version;
  uint8_t nodeId;
  uint32_t topicIdHash;
  uint16_t topicVersion;
  uint8_t topicLeftR;
  uint8_t topicLeftG;
  uint8_t topicLeftB;
  uint8_t topicRightR;
  uint8_t topicRightG;
  uint8_t topicRightB;
  uint8_t topicBrightness;
  uint8_t histogramBinCount;
  uint16_t retentionMinutes;
  uint8_t topicSelectionMode;
  uint8_t topicChoice0R;
  uint8_t topicChoice0G;
  uint8_t topicChoice0B;
  uint8_t topicChoice1R;
  uint8_t topicChoice1G;
  uint8_t topicChoice1B;
  uint8_t topicChoice2R;
  uint8_t topicChoice2G;
  uint8_t topicChoice2B;
  uint8_t opinionValue;
  uint8_t triangleX;
  uint8_t triangleY;
  uint16_t uniquePeerCount;
  uint16_t packetCount;
  uint16_t rawPacketCount;
  uint16_t duplicatePacketCount;
  uint32_t firstSeenMillis;
  uint32_t lastSeenMillis;
  uint8_t histogramOverflow;
  uint8_t peerCount;
  uint8_t encounterSampleCount;
  uint8_t encounterSampleOverflow;
  uint16_t bins[kMaxHistogramBins];
  FlashPeerObservation peers[kUniquePeerCapacity];
  FlashEncounterSample samples[kEncounterSampleCapacity];
  uint16_t crc16;
};

struct ButtonEdgeEvent {
  bool pressed;
  uint32_t atMillis;
};

static_assert(sizeof(EncounterPayload) == 16, "Unexpected BLE payload size");
static_assert(sizeof(FlashHistogramSnapshot) < 3500, "Flash snapshot is unexpectedly large");
static_assert(NEOHEX_COUNT == 37, "NeoHEX RSSI ring mapping expects 37 LEDs");
static_assert(NeohexDisplay::kCenterPixel < NEOHEX_COUNT, "NeoHEX center pixel is outside the LED count");
static_assert(1 + NeohexDisplay::kNearRingCount + NeohexDisplay::kMiddleRingCount + NeohexDisplay::kFarRingCount == NEOHEX_COUNT,
              "NeoHEX RSSI rings must cover the 37 LED layout");
static_assert(NeohexDisplay::kNearRssiDbm > NeohexDisplay::kMiddleRssiDbm,
              "Near RSSI threshold must be greater than middle RSSI threshold");
static_assert(NeohexDisplay::kCenterBrightnessPercent == 100 &&
                  NeohexDisplay::kNearRingBrightnessPercent <= NeohexDisplay::kCenterBrightnessPercent &&
                  NeohexDisplay::kMiddleRingBrightnessPercent <= NeohexDisplay::kNearRingBrightnessPercent &&
                  NeohexDisplay::kFarRingBrightnessPercent <= NeohexDisplay::kMiddleRingBrightnessPercent,
              "NeoHEX ring brightness must fade outward from the center");
static_assert(NeohexDisplay::kCenterPulseMinLevel < NeohexDisplay::kCenterPulseMaxLevel,
              "NeoHEX center pulse range must have a visible span");

static NeohexDisplay neohexDisplay;
static StatusLed statusLed;

static uint32_t topicIdHash = static_cast<uint32_t>(TOPIC_ID_HASH);
static uint16_t topicVersion = static_cast<uint16_t>(TOPIC_VERSION);
static RgbColor topicLeftRgb = {
    static_cast<uint8_t>((static_cast<uint32_t>(TOPIC_LEFT_RGB) >> 16) & 0xFF),
    static_cast<uint8_t>((static_cast<uint32_t>(TOPIC_LEFT_RGB) >> 8) & 0xFF),
    static_cast<uint8_t>(static_cast<uint32_t>(TOPIC_LEFT_RGB) & 0xFF),
};
static RgbColor topicRightRgb = {
    static_cast<uint8_t>((static_cast<uint32_t>(TOPIC_RIGHT_RGB) >> 16) & 0xFF),
    static_cast<uint8_t>((static_cast<uint32_t>(TOPIC_RIGHT_RGB) >> 8) & 0xFF),
    static_cast<uint8_t>(static_cast<uint32_t>(TOPIC_RIGHT_RGB) & 0xFF),
};
static RgbColor topicChoiceRgb[3] = {};
static uint8_t topicSelectionMode = TopicSelectionContinuous;
static uint16_t retentionMinutes = static_cast<uint16_t>(RETENTION_MINUTES);
static uint8_t histogramBinCount = kHistogramBinCountDefault;
static uint8_t opinionValue = DEFAULT_OPINION_VALUE;
static uint8_t triangleX = DEFAULT_OPINION_VALUE;
static uint8_t triangleY = 128;
static uint8_t brightness = NEOHEX_BRIGHTNESS;
static float displayOpinionValue = static_cast<float>(DEFAULT_OPINION_VALUE);
static float displayTriangleX = static_cast<float>(DEFAULT_OPINION_VALUE);
static float displayTriangleY = 128.0f;
static uint8_t lastError = NoError;
static uint8_t deviceNodeId = kZeroNodeIdFallback;
static uint8_t deviceNumber = kMinDeviceNumber;

static HistogramState histogram = {};
static DedupEntry dedupCache[kDedupCacheSize] = {};
static PeerObservation peerObservations[kUniquePeerCapacity] = {};
static uint8_t peerObservationCount = 0;
static EncounterSample encounterSamples[kEncounterSampleCapacity] = {};
static uint8_t encounterSampleNextIndex = 0;
static uint8_t encounterSampleStoredCount = 0;
static bool encounterSampleOverflow = false;
static bool pixelTestMode = false;
static uint32_t lastStatusMillis = 0;
static uint32_t lastPixelTestMillis = 0;
static uint32_t lastDeviceNumberDisplayMillis = 0;
static uint16_t advSeq = 0;
static bool advertisingPayloadDirty = true;
static String serialLine;
static Preferences flashPreferences;
static bool preferencesReady = false;
static bool flashSnapshotReady = false;
static bool flashSnapshotDirty = false;
static uint32_t lastFlashSnapshotAttemptMillis = 0;
static bool buttonStablePressed = false;
static uint32_t buttonPressedStartedMillis = 0;
static uint32_t buttonLastAcceptedEdgeMillis = 0;
static bool buttonResetTriggeredDuringPress = false;
static volatile ButtonEdgeEvent buttonEdgeQueue[kButtonEdgeQueueSize] = {};
static volatile uint8_t buttonEdgeHead = 0;
static volatile uint8_t buttonEdgeTail = 0;
static volatile uint16_t buttonEdgeDroppedCount = 0;
static volatile uint32_t buttonLastQueuedEdgeMillis = 0;

#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
static BLEAdvertising *bleAdvertising = nullptr;
static BLEScan *bleScan = nullptr;
static BLEServer *bleServer = nullptr;
static BLEService *bubbleWalkService = nullptr;
static BLECharacteristic *topicConfigChar = nullptr;
static BLECharacteristic *opinionValueChar = nullptr;
static BLECharacteristic *deviceStatusChar = nullptr;
static BLECharacteristic *histogramChar = nullptr;
static BLECharacteristic *commandChar = nullptr;
static BLECharacteristic *encounterSamplesChar = nullptr;
static uint32_t lastAdvertiseRefreshMillis = 0;
static bool gattServiceReady = false;
static bool gattConnected = false;
static bool syncWindowActive = false;
static bool gattDisconnectedEvent = false;
static bool gattDisconnectRequested = false;
static bool exitSyncWindowRequested = false;
static bool gattConnIdValid = false;
static uint16_t gattConnId = 0;
static uint32_t gattDisconnectAtMillis = 0;
static uint32_t syncWindowDeadlineMillis = 0;
static bool normalBleRolesRunning = false;
static bool syncWindowAwaitingOpinionSync = false;
static bool syncWindowOpinionSynced = false;
static ParticipantBleMode participantBleMode = ParticipantBleIdle;
static uint32_t participantNextSwitchMillis = 0;
static uint32_t participantPhaseCounter = 0;
static char bleName[32] = {};
static char blePickerName[9] = {};
#endif

static void setupDeviceIdentity();
static void setupDeviceNumber();
static uint8_t currentNodeId();
static void renderDisplay();
static void updateGattReadableValues(bool notifyStatus = false);
static void startSyncWindow(const char *reason, uint32_t timeoutMs);
static void closeSyncWindow(const char *reason);
static void startNormalBleRoles();
static void stopNormalBleRoles();
static void setLastError(uint8_t error);
static void setupFlashHistogramSnapshot();
static bool loadFlashHistogramSnapshot();
static void markFlashHistogramSnapshotDirty();
static void updateFlashHistogramSnapshot();
static void updateButton();
static void setupButtonInput();

static bool topicUsesTriangleColor() {
  return topicSelectionMode == TopicSelectionTriangle;
}

static RgbColor colorForTrianglePoint(float xByte, float yByte) {
  return triangleRgb(topicChoiceRgb, xByte, yByte);
}

static RgbColor colorForOpinion(uint8_t value) {
  return blendRgb(topicLeftRgb, topicRightRgb, value);
}

static RgbColor colorForDisplayOpinion() {
  if (topicUsesTriangleColor()) {
    return colorForTrianglePoint(displayTriangleX, displayTriangleY);
  }
  return colorForOpinion(byteFromFloat(displayOpinionValue));
}

static RgbColor colorForEncounter(const EncounterPayload &payload) {
  if (topicUsesTriangleColor()) {
    return colorForTrianglePoint(payload.triangleX, payload.triangleY);
  }
  return colorForOpinion(payload.opinionValue);
}

static uint8_t displayOpinionByte() {
  return static_cast<uint8_t>(lroundf(constrain(displayOpinionValue, 0.0f, 255.0f)));
}

static uint8_t nodeIdFromHardwareIdentity(const uint8_t identity[6]) {
  return identity[5] == 0 ? kZeroNodeIdFallback : identity[5];
}

static uint8_t currentNodeId() {
  return deviceNodeId;
}

static bool isValidDeviceNumber(uint8_t number) {
  return number >= kMinDeviceNumber && number <= kMaxDeviceNumber;
}

static uint8_t fallbackDeviceNumber() {
  const uint8_t nodeId = currentNodeId();
  if (nodeId == 0) return kMinDeviceNumber;
  return static_cast<uint8_t>(((nodeId - 1) % kMaxDeviceNumber) + 1);
}

static void setupDeviceNumber() {
  const uint8_t stored = preferencesReady
                             ? flashPreferences.getUChar(kDeviceNumberKey, 0)
                             : 0;
  if (isValidDeviceNumber(stored)) {
    deviceNumber = stored;
    Serial.printf("device_number=ready value=%u source=preferences\n", deviceNumber);
    return;
  }

  deviceNumber = fallbackDeviceNumber();
  if (preferencesReady) {
    flashPreferences.putUChar(kDeviceNumberKey, deviceNumber);
  }
  Serial.printf("device_number=ready value=%u source=hardware_fallback requires_unique_assignment=1\n",
                deviceNumber);
}

static bool saveDeviceNumber(uint8_t number) {
  if (!isValidDeviceNumber(number)) {
    Serial.printf("error=device_number_out_of_range min=%u max=%u\n",
                  kMinDeviceNumber, kMaxDeviceNumber);
    return false;
  }
  if (!preferencesReady ||
      flashPreferences.putUChar(kDeviceNumberKey, number) != sizeof(number)) {
    Serial.println("error=device_number_save_failed");
    return false;
  }
  deviceNumber = number;
  return true;
}

static void setupDeviceIdentity() {
  uint8_t mac[6] = {};
  if (esp_read_mac(mac, ESP_MAC_BASE) != ESP_OK) {
    Serial.println("device_identity=failed reason=esp_read_mac");
    setLastError(BleOperationFailed);
    return;
  }

  deviceNodeId = nodeIdFromHardwareIdentity(mac);
  Serial.printf("device_identity=ready node_id=%u source=hardware_identity\n",
                currentNodeId());
}

#if defined(CONFIG_NIMBLE_ENABLED) && \
    (defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER))
static bool setupBubbleWalkBleIdentity() {
  uint8_t address[6] = {};
  if (esp_read_mac(address, ESP_MAC_BASE) != ESP_OK) {
    Serial.println("ble_identity=failed reason=esp_read_mac");
    return false;
  }

  // Move BubbleWalk into a deterministic random-static address namespace.
  // This keeps one shared firmware image and a stable identity per device,
  // while making browsers discard names cached from pre-numbered firmware.
  address[0] = static_cast<uint8_t>((address[0] & 0x3F) | 0xC0);
  BLEAddress bubbleWalkAddress(address, BLE_ADDR_RANDOM);
  if (!BLEDevice::setOwnAddr(bubbleWalkAddress) ||
      !BLEDevice::setOwnAddrType(BLE_OWN_ADDR_RANDOM)) {
    Serial.println("ble_identity=failed reason=random_static_address");
    return false;
  }

  Serial.println("ble_identity=ready type=bubblewalk_random_static");
  return true;
}
#endif

static const char *roleName() {
#if ROLE_IS_PARTICIPANT
  return "participant";
#elif defined(ROLE_ADVERTISER)
  return "advertiser";
#elif defined(ROLE_SCANNER)
  return "scanner";
#else
  return "bringup";
#endif
}

static uint8_t roleFlags() {
  uint8_t flags = 0;
#if defined(ROLE_ADVERTISER)
  flags |= 0x01;
#endif
#if defined(ROLE_SCANNER)
  flags |= 0x02;
#endif
#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
  if (syncWindowActive) {
    flags |= 0x04;
  }
#endif
  return flags;
}

static void setLastError(uint8_t error) {
  lastError = error;
}

static void resetTopicChoiceRgbFromGradient() {
  topicChoiceRgb[0] = topicLeftRgb;
  topicChoiceRgb[1] = colorForOpinion(128);
  topicChoiceRgb[2] = topicRightRgb;
}

static bool isSyncStatusActive() {
#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
  return syncWindowActive || gattConnected;
#else
  return false;
#endif
}

static bool isFastSyncStatusActive() {
#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
  return syncWindowActive && syncWindowAwaitingOpinionSync;
#else
  return false;
#endif
}

static bool isEncounterStatusActive() {
#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
  return normalBleRolesRunning && !syncWindowActive && !gattConnected;
#else
  return false;
#endif
}

static void triggerStatusLedFlash(RgbColor color, uint32_t durationMs) {
  statusLed.flash(color, durationMs, millis());
}

static void startStatusLedResetIndicator() {
  statusLed.startResetIndicator(millis());
}

static void updateStatusLed() {
  statusLed.update(isSyncStatusActive(), isFastSyncStatusActive(),
                   isEncounterStatusActive(), millis());
}

static bool peerObservationWithinEncounterDisplayRetention(
    const PeerObservation &peer, uint32_t now) {
  if (!peer.valid) return false;
  if (retentionMinutes == 0) return true;
  const uint32_t retentionMillis =
      static_cast<uint32_t>(retentionMinutes) * 60UL * 1000UL;
  return now - peer.lastSeenMillis < retentionMillis;
}

static void renderDisplay() {
  neohexDisplay.render(colorForDisplayOpinion(), brightness, retentionMinutes,
                       millis());
}

static void updateNeohexCenterPulse() {
#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
  if (syncWindowActive) {
    const uint32_t now = millis();
    if (lastDeviceNumberDisplayMillis == 0 ||
        now - lastDeviceNumberDisplayMillis >= NeohexDisplay::kFrameMs) {
      lastDeviceNumberDisplayMillis = now;
      const uint8_t numberBrightness =
          brightness < kDeviceNumberDisplayMinBrightness
              ? kDeviceNumberDisplayMinBrightness
              : brightness;
      neohexDisplay.showDeviceNumber(deviceNumber, kDeviceNumberColor,
                                     numberBrightness);
    }
    return;
  }
#endif
  lastDeviceNumberDisplayMillis = 0;
  if (pixelTestMode) return;
  neohexDisplay.update(colorForDisplayOpinion(), brightness, retentionMinutes,
                       millis());
}

static void showPixelTestStep() {
  neohexDisplay.showPixelTestStep(colorForOpinion(opinionValue), brightness);
}

static void resetDisplayOpinionValue(const char *source) {
  (void)source;
  displayOpinionValue = static_cast<float>(opinionValue);
  displayTriangleX = static_cast<float>(triangleX);
  displayTriangleY = static_cast<float>(triangleY);
  renderDisplay();
}

static void resetEncounterDisplayRing() {
  neohexDisplay.clearEncounters();
}

static void printEncounterDisplayUpdate(
    const EncounterPayload &payload, int8_t rssi,
    const EncounterDisplayUpdate &update) {
  if (!update.placed) return;
  const RgbColor color = colorForEncounter(payload);
  Serial.printf("encounter_ring_update level=%s rssi=%d pixel=%u brightness_percent=%u replaced=%u node_id=%u seq=%u opinion_value=%u triangle_xy=%u,%u rgb=%u,%u,%u stored=%u overflow=%u thresholds_dbm=%d,%d\n",
                NeohexDisplay::distanceName(update.level), static_cast<int>(rssi),
                update.pixel, update.brightnessPercent,
                update.usedEmptyPixel ? 0 : 1, payload.nodeId, payload.seq,
                payload.opinionValue, payload.triangleX, payload.triangleY,
                color.r, color.g, color.b, update.storedCount,
                update.overflow ? 1 : 0,
                static_cast<int>(NeohexDisplay::kNearRssiDbm),
                static_cast<int>(NeohexDisplay::kMiddleRssiDbm));
}

static void restoreEncounterDisplayRingFromPeerObservations(const char *source) {
  resetEncounterDisplayRing();
  const uint32_t now = millis();
  uint8_t restoredPeerCount = 0;
  uint8_t skippedExpiredPeerCount = 0;
  for (uint8_t i = 0; i < kUniquePeerCapacity; i++) {
    const PeerObservation &peer = peerObservations[i];
    if (!peer.valid) {
      continue;
    }
    if (!peerObservationWithinEncounterDisplayRetention(peer, now)) {
      skippedExpiredPeerCount++;
      continue;
    }
    const EncounterPayload payload = {
        kCompanyId,
        kMagic,
        kPayloadVersion,
        peer.nodeId,
        topicIdHash,
        peer.opinionValue,
        peer.lastSeq,
        peer.triangleX,
        peer.triangleY,
        0,
    };
    const EncounterDisplayUpdate update = neohexDisplay.restoreEncounter(
        colorForEncounter(payload), payload.nodeId, payload.seq, peer.lastRssi,
        peer.lastSeenMillis);
    printEncounterDisplayUpdate(payload, peer.lastRssi, update);
    restoredPeerCount++;
  }
  Serial.printf("encounter_ring_restored source=%s restored_peer_count=%u skipped_expired_peer_count=%u display_slots=%u overflow=%u retention_minutes=%u\n",
                source, restoredPeerCount, skippedExpiredPeerCount,
                neohexDisplay.storedCount(), neohexDisplay.overflowed() ? 1 : 0,
                retentionMinutes);
}

static void resetDedupCache() {
  memset(dedupCache, 0, sizeof(dedupCache));
}

static void resetPeerObservations() {
  memset(peerObservations, 0, sizeof(peerObservations));
  peerObservationCount = 0;
}

static void resetEncounterSamples() {
  memset(encounterSamples, 0, sizeof(encounterSamples));
  encounterSampleNextIndex = 0;
  encounterSampleStoredCount = 0;
  encounterSampleOverflow = false;
}

static void resetHistogram() {
  memset(&histogram, 0, sizeof(histogram));
  resetDedupCache();
  resetPeerObservations();
  resetEncounterSamples();
  resetEncounterDisplayRing();
  resetDisplayOpinionValue("reset");
  updateGattReadableValues(false);
  markFlashHistogramSnapshotDirty();
  Serial.println("histogram=reset");
}

static uint8_t histogramBinForOpinion(uint8_t value) {
  const uint16_t bin = (static_cast<uint16_t>(value) * histogramBinCount) / 256;
  return static_cast<uint8_t>(bin >= histogramBinCount ? histogramBinCount - 1 : bin);
}

static void incrementHistogramCounter(uint16_t *counter) {
  if (*counter < UINT16_MAX) {
    (*counter)++;
    return;
  }
  histogram.overflow = true;
}

static void decrementHistogramBin(uint8_t bin) {
  if (bin < histogramBinCount && histogram.bins[bin] > 0) {
    histogram.bins[bin]--;
  }
}

static void incrementHistogramBin(uint8_t bin) {
  if (bin < histogramBinCount && histogram.bins[bin] < UINT16_MAX) {
    histogram.bins[bin]++;
    return;
  }
  histogram.overflow = true;
}

static void recordEncounterSample(const EncounterPayload &payload,
                                  uint8_t bin,
                                  int8_t rssi,
                                  uint32_t seenAtMillis) {
  encounterSamples[encounterSampleNextIndex] = {
      payload.nodeId,
      payload.opinionValue,
      bin,
      rssi,
      payload.seq,
      payload.triangleX,
      payload.triangleY,
      seenAtMillis,
      true,
  };
  encounterSampleNextIndex = (encounterSampleNextIndex + 1) % kEncounterSampleCapacity;
  if (encounterSampleStoredCount < kEncounterSampleCapacity) {
    encounterSampleStoredCount++;
  } else {
    encounterSampleOverflow = true;
  }
}

static bool updateUniquePeerHistogram(const EncounterPayload &payload,
                                      uint8_t bin,
                                      int8_t rssi,
                                      uint32_t seenAtMillis) {
  int8_t emptyIndex = -1;
  int8_t existingIndex = -1;
  uint8_t oldestIndex = 0;
  uint32_t oldestAge = 0;

  for (uint8_t i = 0; i < kUniquePeerCapacity; i++) {
    PeerObservation &peer = peerObservations[i];
    if (!peer.valid) {
      if (emptyIndex < 0) {
        emptyIndex = static_cast<int8_t>(i);
      }
      continue;
    }
    if (peer.nodeId == payload.nodeId) {
      existingIndex = static_cast<int8_t>(i);
      break;
    }
    const uint32_t age = seenAtMillis - peer.lastSeenMillis;
    if (age >= oldestAge) {
      oldestAge = age;
      oldestIndex = i;
    }
  }

  if (existingIndex >= 0) {
    PeerObservation &peer = peerObservations[existingIndex];
    if (peer.binIndex != bin) {
      decrementHistogramBin(peer.binIndex);
      incrementHistogramBin(bin);
    }
    peer.opinionValue = payload.opinionValue;
    peer.triangleX = payload.triangleX;
    peer.triangleY = payload.triangleY;
    peer.binIndex = bin;
    peer.lastSeenMillis = seenAtMillis;
    peer.lastRssi = rssi;
    peer.lastSeq = payload.seq;
    incrementHistogramCounter(&peer.packetCount);
    return false;
  }

  const bool hasEmptySlot = emptyIndex >= 0;
  const uint8_t targetIndex = hasEmptySlot ? static_cast<uint8_t>(emptyIndex) : oldestIndex;
  bool uniquePeerAdded = false;

  if (!hasEmptySlot) {
    PeerObservation &replaced = peerObservations[targetIndex];
    decrementHistogramBin(replaced.binIndex);
    histogram.overflow = true;
  } else if (peerObservationCount < kUniquePeerCapacity) {
    peerObservationCount++;
    uniquePeerAdded = true;
  }

  peerObservations[targetIndex] = {
      payload.nodeId,
      payload.opinionValue,
      payload.triangleX,
      payload.triangleY,
      bin,
      1,
      seenAtMillis,
      rssi,
      payload.seq,
      true,
  };
  histogram.uniquePeerCount = peerObservationCount;
  incrementHistogramBin(bin);
  return uniquePeerAdded;
}

static bool shouldAddHistogramSample(const EncounterPayload &payload,
                                     uint32_t seenAtMillis) {
  if (payload.nodeId == currentNodeId()) {
    return false;
  }
  incrementHistogramCounter(&histogram.rawPacketCount);

  int8_t emptyIndex = -1;
  uint8_t oldestIndex = 0;
  uint32_t oldestAge = 0;
  for (uint8_t i = 0; i < kDedupCacheSize; i++) {
    DedupEntry &entry = dedupCache[i];
    if (!entry.valid) {
      if (emptyIndex < 0) {
        emptyIndex = static_cast<int8_t>(i);
      }
      continue;
    }
    if (entry.nodeId == payload.nodeId &&
        entry.seq == payload.seq &&
        entry.topicIdHash == payload.topicIdHash) {
      const uint32_t age = seenAtMillis - entry.lastSeenMillis;
      entry.lastSeenMillis = seenAtMillis;
      if (age <= DEDUP_WINDOW_MS) {
        incrementHistogramCounter(&histogram.duplicatePacketCount);
        return false;
      }
      return true;
    }
    const uint32_t age = seenAtMillis - entry.lastSeenMillis;
    if (age >= oldestAge) {
      oldestAge = age;
      oldestIndex = i;
    }
  }

  const uint8_t targetIndex = emptyIndex >= 0 ? static_cast<uint8_t>(emptyIndex) : oldestIndex;
  dedupCache[targetIndex] = {
      payload.nodeId,
      payload.seq,
      payload.topicIdHash,
      seenAtMillis,
      true,
  };
  return true;
}

static void addHistogramSample(const EncounterPayload &payload,
                               int8_t rssi,
                               uint32_t seenAtMillis) {
  const uint8_t bin = histogramBinForOpinion(payload.opinionValue);
  if (histogram.packetCount == 0) {
    histogram.firstSeenMillis = seenAtMillis;
  }
  histogram.lastSeenMillis = seenAtMillis;
  incrementHistogramCounter(&histogram.packetCount);

  const bool uniquePeerAdded =
      updateUniquePeerHistogram(payload, bin, rssi, seenAtMillis);
  recordEncounterSample(payload, bin, rssi, seenAtMillis);
  const EncounterDisplayUpdate displayUpdate = neohexDisplay.observeEncounter(
      colorForEncounter(payload), payload.nodeId, payload.seq, rssi,
      seenAtMillis, retentionMinutes, uniquePeerAdded, true);
  printEncounterDisplayUpdate(payload, rssi, displayUpdate);

  renderDisplay();
  updateGattReadableValues(false);
  markFlashHistogramSnapshotDirty();

  Serial.printf("histogram_update bin=%u opinion_value=%u unique_peer_count=%u packet_count=%u raw_packet_count=%u duplicate_packet_count=%u unique_peer_added=%u display_slot_missing=%u display_level_changed=%u\n",
                bin, payload.opinionValue, histogram.uniquePeerCount,
                histogram.packetCount, histogram.rawPacketCount,
                histogram.duplicatePacketCount, uniquePeerAdded ? 1 : 0,
                displayUpdate.slotMissing ? 1 : 0,
                displayUpdate.levelChanged ? 1 : 0);
}

static EncounterPayload makeEncounterPayload(uint16_t seq) {
  return {
      kCompanyId,
      kMagic,
      kPayloadVersion,
      currentNodeId(),
      topicIdHash,
      opinionValue,
      seq,
      triangleX,
      triangleY,
      0,
  };
}

static bool parseEncounterPayload(const String &manufacturerData, EncounterPayload *payload) {
  const int len = manufacturerData.length();
  if (len < 13) {
    return false;
  }
  const uint8_t *data = reinterpret_cast<const uint8_t *>(manufacturerData.c_str());
  memset(payload, 0, sizeof(EncounterPayload));
  payload->companyId = readLe16(data);
  payload->magic = readLe16(data + 2);
  payload->version = data[4];
  payload->nodeId = data[5];
  payload->topicIdHash = readLe32(data + 6);
  payload->opinionValue = data[10];
  payload->seq = readLe16(data + 11);
  payload->triangleX = payload->opinionValue;
  payload->triangleY = 128;
  if (payload->version == kPayloadVersion) {
    if (len < static_cast<int>(sizeof(EncounterPayload))) {
      return false;
    }
    payload->triangleX = data[13];
    payload->triangleY = data[14];
    payload->reserved = data[15];
  } else if (payload->version != kPayloadVersionV1) {
    return false;
  }
  return payload->companyId == kCompanyId && payload->magic == kMagic;
}

static void encodeDeviceStatus(uint8_t *buffer) {
  memset(buffer, 0, kDeviceStatusLength);
  const RgbColor ledRgb = colorForDisplayOpinion();
  buffer[0] = kLayoutVersion;
  buffer[1] = kDeviceStatusLength;
  buffer[2] = kFirmwareMajor;
  buffer[3] = kFirmwareMinor;
  buffer[4] = kFirmwarePatch;
  buffer[5] = kProtocolVersion;
  buffer[6] = currentNodeId();
  buffer[7] = roleFlags();
  writeLe32(buffer + 8, topicIdHash);
  writeLe16(buffer + 12, topicVersion);
  buffer[14] = opinionValue;
  buffer[15] = ledRgb.r;
  buffer[16] = ledRgb.g;
  buffer[17] = ledRgb.b;
  buffer[18] = brightness;
  buffer[19] = histogramBinCount;
  writeLe16(buffer + 20, histogram.uniquePeerCount);
  writeLe16(buffer + 22, advSeq);
  buffer[24] = lastError;
  writeLe32(buffer + 25, millis());
  buffer[29] = triangleX;
  buffer[30] = triangleY;
  buffer[31] = displayOpinionByte();
}

static uint8_t encodeHistogram(uint8_t *buffer) {
  const uint8_t payloadLength = kHistogramHeaderLength + histogramBinCount * 2;
  memset(buffer, 0, kMaxHistogramPayloadLength);
  buffer[0] = kLayoutVersion;
  buffer[1] = payloadLength;
  writeLe32(buffer + 2, topicIdHash);
  writeLe16(buffer + 6, topicVersion);
  buffer[8] = histogramBinCount;
  buffer[9] = kHistogramCounterWidth;
  writeLe16(buffer + 10, histogram.uniquePeerCount);
  writeLe32(buffer + 12, histogram.firstSeenMillis);
  writeLe32(buffer + 16, histogram.lastSeenMillis);
  buffer[20] = histogram.overflow ? 0x01 : 0x00;
  for (uint8_t i = 0; i < histogramBinCount; i++) {
    writeLe16(buffer + kHistogramHeaderLength + i * 2, histogram.bins[i]);
  }
  return payloadLength;
}

static uint8_t encodeEncounterSamples(uint8_t *buffer) {
  const uint8_t storedCount = encounterSampleStoredCount;
  const uint8_t payloadLength = kEncounterSamplesHeaderLength + storedCount * kEncounterSampleEntryLength;
  memset(buffer, 0, kMaxEncounterSamplesPayloadLength);
  buffer[0] = kLayoutVersion;
  buffer[1] = payloadLength;
  writeLe32(buffer + 2, topicIdHash);
  writeLe16(buffer + 6, topicVersion);
  buffer[8] = kEncounterSampleCapacity;
  buffer[9] = storedCount;
  writeLe16(buffer + 10, histogram.packetCount);
  buffer[12] = encounterSampleOverflow ? 0x01 : 0x00;
  buffer[13] = kEncounterSampleEntryLength;
  const uint8_t startIndex =
      (storedCount == kEncounterSampleCapacity) ? encounterSampleNextIndex : 0;
  const uint32_t now = millis();
  for (uint8_t outputIndex = 0; outputIndex < storedCount; outputIndex++) {
    const uint8_t sampleIndex = (startIndex + outputIndex) % kEncounterSampleCapacity;
    const EncounterSample &sample = encounterSamples[sampleIndex];
    uint8_t *entry = buffer + kEncounterSamplesHeaderLength + outputIndex * kEncounterSampleEntryLength;
    entry[0] = sample.nodeId;
    entry[1] = sample.opinionValue;
    entry[2] = sample.binIndex;
    entry[3] = static_cast<uint8_t>(sample.rssi);
    writeLe16(entry + 4, sample.seq);
    const uint32_t ageSeconds = sample.valid ? ((now - sample.seenMillis) / 1000UL) : 0;
    writeLe16(entry + 6, static_cast<uint16_t>(ageSeconds > UINT16_MAX ? UINT16_MAX : ageSeconds));
    entry[8] = sample.triangleX;
    entry[9] = sample.triangleY;
  }
  return payloadLength;
}

static void updateGattReadableValues(bool notifyStatus) {
#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
  if (!gattServiceReady || deviceStatusChar == nullptr) {
    return;
  }
  uint8_t statusBuffer[kDeviceStatusLength];
  encodeDeviceStatus(statusBuffer);
  deviceStatusChar->setValue(statusBuffer, sizeof(statusBuffer));
  if (notifyStatus && gattConnected) {
    deviceStatusChar->notify();
  }

  uint8_t histogramBuffer[kMaxHistogramPayloadLength];
  const uint8_t histogramLength = encodeHistogram(histogramBuffer);
  histogramChar->setValue(histogramBuffer, histogramLength);

  uint8_t samplesBuffer[kMaxEncounterSamplesPayloadLength];
  const uint8_t samplesLength = encodeEncounterSamples(samplesBuffer);
  encounterSamplesChar->setValue(samplesBuffer, samplesLength);
#else
  (void)notifyStatus;
#endif
}

static void setupFlashHistogramSnapshot() {
  preferencesReady = flashPreferences.begin(kFlashSnapshotNamespace, false);
#if ENABLE_FLASH_HISTOGRAM_SNAPSHOT
  flashSnapshotReady = preferencesReady;
  if (flashSnapshotReady) {
    Serial.printf("flash_snapshot=ready namespace=%s key=%s\n",
                  kFlashSnapshotNamespace, kFlashSnapshotKey);
  } else {
    Serial.println("flash_snapshot=disabled reason=preferences_begin_failed");
  }
#else
  flashSnapshotReady = false;
  Serial.printf("flash_snapshot=disabled preferences=%s\n",
                preferencesReady ? "ready" : "failed");
#endif
}

static void markFlashHistogramSnapshotDirty() {
#if ENABLE_FLASH_HISTOGRAM_SNAPSHOT
  if (flashSnapshotReady) {
    flashSnapshotDirty = true;
  }
#endif
}

static bool saveFlashHistogramSnapshot() {
#if ENABLE_FLASH_HISTOGRAM_SNAPSHOT
  if (!flashSnapshotReady) {
    return false;
  }

  FlashHistogramSnapshot snapshot = {};
  snapshot.magic = kFlashHistogramSnapshotMagic;
  snapshot.length = static_cast<uint16_t>(sizeof(FlashHistogramSnapshot));
  snapshot.version = kFlashHistogramSnapshotVersion;
  snapshot.nodeId = currentNodeId();
  snapshot.topicIdHash = topicIdHash;
  snapshot.topicVersion = topicVersion;
  snapshot.topicLeftR = topicLeftRgb.r;
  snapshot.topicLeftG = topicLeftRgb.g;
  snapshot.topicLeftB = topicLeftRgb.b;
  snapshot.topicRightR = topicRightRgb.r;
  snapshot.topicRightG = topicRightRgb.g;
  snapshot.topicRightB = topicRightRgb.b;
  snapshot.topicBrightness = brightness;
  snapshot.histogramBinCount = histogramBinCount;
  snapshot.retentionMinutes = retentionMinutes;
  snapshot.topicSelectionMode = topicSelectionMode;
  snapshot.topicChoice0R = topicChoiceRgb[0].r;
  snapshot.topicChoice0G = topicChoiceRgb[0].g;
  snapshot.topicChoice0B = topicChoiceRgb[0].b;
  snapshot.topicChoice1R = topicChoiceRgb[1].r;
  snapshot.topicChoice1G = topicChoiceRgb[1].g;
  snapshot.topicChoice1B = topicChoiceRgb[1].b;
  snapshot.topicChoice2R = topicChoiceRgb[2].r;
  snapshot.topicChoice2G = topicChoiceRgb[2].g;
  snapshot.topicChoice2B = topicChoiceRgb[2].b;
  snapshot.opinionValue = opinionValue;
  snapshot.triangleX = triangleX;
  snapshot.triangleY = triangleY;
  snapshot.uniquePeerCount = histogram.uniquePeerCount;
  snapshot.packetCount = histogram.packetCount;
  snapshot.rawPacketCount = histogram.rawPacketCount;
  snapshot.duplicatePacketCount = histogram.duplicatePacketCount;
  snapshot.firstSeenMillis = histogram.firstSeenMillis;
  snapshot.lastSeenMillis = histogram.lastSeenMillis;
  snapshot.histogramOverflow = histogram.overflow ? 1 : 0;
  snapshot.peerCount = peerObservationCount;
  snapshot.encounterSampleCount = encounterSampleStoredCount;
  snapshot.encounterSampleOverflow = encounterSampleOverflow ? 1 : 0;
  for (uint8_t i = 0; i < kMaxHistogramBins; i++) {
    snapshot.bins[i] = histogram.bins[i];
  }

  const uint32_t now = millis();
  for (uint8_t i = 0; i < kUniquePeerCapacity; i++) {
    const PeerObservation &peer = peerObservations[i];
    FlashPeerObservation &out = snapshot.peers[i];
    out.valid = peer.valid ? 1 : 0;
    out.nodeId = peer.nodeId;
    out.opinionValue = peer.opinionValue;
    out.triangleX = peer.triangleX;
    out.triangleY = peer.triangleY;
    out.binIndex = peer.binIndex;
    out.packetCount = peer.packetCount;
    out.lastRssi = peer.lastRssi;
    out.lastSeq = peer.lastSeq;
    const uint32_t ageSeconds = peer.valid ? ((now - peer.lastSeenMillis) / 1000UL) : 0;
    out.ageSeconds = static_cast<uint16_t>(ageSeconds > UINT16_MAX ? UINT16_MAX : ageSeconds);
  }

  const uint8_t storedCount = encounterSampleStoredCount;
  const uint8_t startIndex =
      (storedCount == kEncounterSampleCapacity) ? encounterSampleNextIndex : 0;
  for (uint8_t outputIndex = 0; outputIndex < storedCount; outputIndex++) {
    const uint8_t sampleIndex = (startIndex + outputIndex) % kEncounterSampleCapacity;
    const EncounterSample &sample = encounterSamples[sampleIndex];
    FlashEncounterSample &out = snapshot.samples[outputIndex];
    out.valid = sample.valid ? 1 : 0;
    out.nodeId = sample.nodeId;
    out.opinionValue = sample.opinionValue;
    out.binIndex = sample.binIndex;
    out.rssi = sample.rssi;
    out.seq = sample.seq;
    out.triangleX = sample.triangleX;
    out.triangleY = sample.triangleY;
    const uint32_t ageSeconds = sample.valid ? ((now - sample.seenMillis) / 1000UL) : 0;
    out.ageSeconds = static_cast<uint16_t>(ageSeconds > UINT16_MAX ? UINT16_MAX : ageSeconds);
  }

  snapshot.crc16 = crc16CcittFalse(
      reinterpret_cast<const uint8_t *>(&snapshot),
      sizeof(FlashHistogramSnapshot) - sizeof(snapshot.crc16));
  const size_t written = flashPreferences.putBytes(kFlashSnapshotKey, &snapshot, sizeof(snapshot));
  if (written != sizeof(snapshot)) {
    Serial.printf("flash_snapshot=save_failed written=%u expected=%u\n",
                  static_cast<unsigned>(written), static_cast<unsigned>(sizeof(snapshot)));
    return false;
  }
  flashSnapshotDirty = false;
  lastFlashSnapshotAttemptMillis = now;
  Serial.printf("flash_snapshot=saved unique_peer_count=%u packet_count=%u sample_count=%u\n",
                histogram.uniquePeerCount, histogram.packetCount, encounterSampleStoredCount);
  return true;
#else
  return false;
#endif
}

static bool loadFlashHistogramSnapshot() {
#if ENABLE_FLASH_HISTOGRAM_SNAPSHOT
  if (!flashSnapshotReady) {
    return false;
  }
  if (flashPreferences.getBytesLength(kFlashSnapshotKey) != sizeof(FlashHistogramSnapshot)) {
    Serial.println("flash_snapshot=missing");
    return false;
  }

  FlashHistogramSnapshot snapshot = {};
  const size_t readLen = flashPreferences.getBytes(kFlashSnapshotKey, &snapshot, sizeof(snapshot));
  const uint16_t expectedCrc = crc16CcittFalse(
      reinterpret_cast<const uint8_t *>(&snapshot),
      sizeof(FlashHistogramSnapshot) - sizeof(snapshot.crc16));
  if (readLen != sizeof(snapshot) ||
      snapshot.magic != kFlashHistogramSnapshotMagic ||
      snapshot.length != sizeof(FlashHistogramSnapshot) ||
      snapshot.version != kFlashHistogramSnapshotVersion ||
      snapshot.nodeId != currentNodeId() ||
      snapshot.crc16 != expectedCrc ||
      (snapshot.histogramBinCount != 8 && snapshot.histogramBinCount != 16)) {
    Serial.println("flash_snapshot=ignored reason=invalid");
    return false;
  }

  topicIdHash = snapshot.topicIdHash;
  topicVersion = snapshot.topicVersion;
  topicLeftRgb = {snapshot.topicLeftR, snapshot.topicLeftG, snapshot.topicLeftB};
  topicRightRgb = {snapshot.topicRightR, snapshot.topicRightG, snapshot.topicRightB};
  brightness = snapshot.topicBrightness;
  histogramBinCount = snapshot.histogramBinCount;
  retentionMinutes = snapshot.retentionMinutes;
  topicSelectionMode =
      snapshot.topicSelectionMode <= TopicSelectionTriangle
          ? snapshot.topicSelectionMode
          : TopicSelectionContinuous;
  topicChoiceRgb[0] = {snapshot.topicChoice0R, snapshot.topicChoice0G, snapshot.topicChoice0B};
  topicChoiceRgb[1] = {snapshot.topicChoice1R, snapshot.topicChoice1G, snapshot.topicChoice1B};
  topicChoiceRgb[2] = {snapshot.topicChoice2R, snapshot.topicChoice2G, snapshot.topicChoice2B};
  opinionValue = snapshot.opinionValue;
  triangleX = snapshot.triangleX;
  triangleY = snapshot.triangleY;

  memset(&histogram, 0, sizeof(histogram));
  histogram.uniquePeerCount = snapshot.uniquePeerCount;
  histogram.packetCount = snapshot.packetCount;
  histogram.rawPacketCount = snapshot.rawPacketCount;
  histogram.duplicatePacketCount = snapshot.duplicatePacketCount;
  histogram.firstSeenMillis = 0;
  histogram.lastSeenMillis =
      snapshot.packetCount > 0 ? snapshot.lastSeenMillis - snapshot.firstSeenMillis : 0;
  histogram.overflow = snapshot.histogramOverflow != 0;
  for (uint8_t i = 0; i < kMaxHistogramBins; i++) {
    histogram.bins[i] = snapshot.bins[i];
  }

  resetDedupCache();
  resetPeerObservations();
  resetEncounterSamples();
  const uint32_t now = millis();
  uint8_t restoredPeerCount = 0;
  for (uint8_t i = 0; i < kUniquePeerCapacity; i++) {
    const FlashPeerObservation &in = snapshot.peers[i];
    if (!in.valid) {
      continue;
    }
    PeerObservation &out = peerObservations[i];
    out.nodeId = in.nodeId;
    out.opinionValue = in.opinionValue;
    out.triangleX = in.triangleX;
    out.triangleY = in.triangleY;
    out.binIndex = in.binIndex;
    out.packetCount = in.packetCount;
    out.lastRssi = in.lastRssi;
    out.lastSeq = in.lastSeq;
    const uint32_t ageMillis = static_cast<uint32_t>(in.ageSeconds) * 1000UL;
    out.lastSeenMillis = now - ageMillis;
    out.valid = true;
    if (restoredPeerCount < kUniquePeerCapacity) {
      restoredPeerCount++;
    }
  }
  peerObservationCount = restoredPeerCount;
  histogram.uniquePeerCount = restoredPeerCount;
  if (restoredPeerCount != snapshot.peerCount ||
      restoredPeerCount != snapshot.uniquePeerCount) {
    histogram.overflow = true;
  }

  const uint8_t restoredSampleCount =
      snapshot.encounterSampleCount > kEncounterSampleCapacity
          ? kEncounterSampleCapacity
          : snapshot.encounterSampleCount;
  for (uint8_t i = 0; i < restoredSampleCount; i++) {
    const FlashEncounterSample &in = snapshot.samples[i];
    EncounterSample &out = encounterSamples[i];
    out.nodeId = in.nodeId;
    out.opinionValue = in.opinionValue;
    out.binIndex = in.binIndex;
    out.rssi = in.rssi;
    out.seq = in.seq;
    out.triangleX = in.triangleX;
    out.triangleY = in.triangleY;
    const uint32_t ageMillis = static_cast<uint32_t>(in.ageSeconds) * 1000UL;
    out.seenMillis = now - ageMillis;
    out.valid = in.valid != 0;
  }
  encounterSampleStoredCount = restoredSampleCount;
  encounterSampleNextIndex = restoredSampleCount % kEncounterSampleCapacity;
  encounterSampleOverflow = snapshot.encounterSampleOverflow != 0;

  restoreEncounterDisplayRingFromPeerObservations("flash_snapshot");
  flashSnapshotDirty = false;
  resetDisplayOpinionValue("flash");
  advertisingPayloadDirty = true;
  setLastError(NoError);
  Serial.printf("flash_snapshot=restored unique_peer_count=%u packet_count=%u sample_count=%u\n",
                histogram.uniquePeerCount, histogram.packetCount, encounterSampleStoredCount);
  return true;
#else
  return false;
#endif
}

static void updateFlashHistogramSnapshot() {
#if ENABLE_FLASH_HISTOGRAM_SNAPSHOT
  if (!flashSnapshotReady || !flashSnapshotDirty) {
    return;
  }
  const uint32_t now = millis();
  if (now - lastFlashSnapshotAttemptMillis < FLASH_HISTOGRAM_SNAPSHOT_INTERVAL_MS) {
    return;
  }
  lastFlashSnapshotAttemptMillis = now;
  saveFlashHistogramSnapshot();
#endif
}

static bool validateCrc(const uint8_t *data, uint16_t len, uint16_t crcOffset) {
  return len > crcOffset + 1 && readLe16(data + crcOffset) == crc16CcittFalse(data, crcOffset);
}

static void setOpinionState(uint8_t value,
                            uint8_t nextTriangleX,
                            uint8_t nextTriangleY,
                            const char *source) {
  opinionValue = value;
  triangleX = nextTriangleX;
  triangleY = nextTriangleY;
  resetDisplayOpinionValue(source);
  advertisingPayloadDirty = true;
  setLastError(NoError);
  Serial.printf("opinion_value=%u triangle_xy=%u,%u source=%s\n",
                opinionValue, triangleX, triangleY, source);
  updateGattReadableValues(true);
  markFlashHistogramSnapshotDirty();
}

static void applyTopicConfig(const uint8_t *data, uint16_t len) {
  if ((len != kTopicConfigLengthV1 && len != kTopicConfigLength) || data[1] != len) {
    setLastError(InvalidLength);
    return;
  }
  if (data[0] != kLayoutVersion) {
    setLastError(UnsupportedLayoutVersion);
    return;
  }
  const uint16_t crcOffset = len - 2;
  if (!validateCrc(data, len, crcOffset)) {
    setLastError(CrcMismatch);
    return;
  }
  if (data[15] != 8 && data[15] != 16) {
    setLastError(UnsupportedHistogramBins);
    return;
  }

  const uint32_t nextTopicIdHash = readLe32(data + 2);
  const uint16_t nextTopicVersion = readLe16(data + 6);
  const uint8_t nextHistogramBins = data[15];
  const uint8_t nextSelectionMode =
      len == kTopicConfigLength ? data[18] : TopicSelectionContinuous;
  if (nextSelectionMode > TopicSelectionTriangle) {
    setLastError(UnsupportedLayoutVersion);
    return;
  }

  const bool topicChanged =
      nextTopicIdHash != topicIdHash ||
      nextTopicVersion != topicVersion ||
      nextHistogramBins != histogramBinCount ||
      nextSelectionMode != topicSelectionMode;

  topicIdHash = nextTopicIdHash;
  topicVersion = nextTopicVersion;
  topicLeftRgb = {data[8], data[9], data[10]};
  topicRightRgb = {data[11], data[12], data[13]};
  brightness = data[14];
  histogramBinCount = nextHistogramBins;
  retentionMinutes = readLe16(data + 16);
  topicSelectionMode = nextSelectionMode;
  if (len == kTopicConfigLength) {
    topicChoiceRgb[0] = {data[20], data[21], data[22]};
    topicChoiceRgb[1] = {data[23], data[24], data[25]};
    topicChoiceRgb[2] = {data[26], data[27], data[28]};
  } else {
    resetTopicChoiceRgbFromGradient();
  }
  if (topicChanged) {
    resetHistogram();
  }
  renderDisplay();
  advertisingPayloadDirty = true;
  setLastError(NoError);
  Serial.printf("topic_config=applied topic_id_hash=0x%08lX topic_version=%u brightness=%u histogram_bins=%u selection_mode=%u retention_minutes=%u\n",
                static_cast<unsigned long>(topicIdHash), topicVersion,
                brightness, histogramBinCount, topicSelectionMode, retentionMinutes);
  updateGattReadableValues(true);
  markFlashHistogramSnapshotDirty();
}

static void applyOpinionValue(const uint8_t *data, uint16_t len) {
  if (len != kOpinionValueLength && len != kOpinionValueLengthV1) {
    setLastError(InvalidLength);
    return;
  }
  if (data[0] != kLayoutVersion) {
    setLastError(UnsupportedLayoutVersion);
    return;
  }
  const uint16_t crcOffset = (len == kOpinionValueLength) ? 10 : 8;
  if (!validateCrc(data, len, crcOffset)) {
    setLastError(CrcMismatch);
    return;
  }
  if (readLe32(data + 1) != topicIdHash || readLe16(data + 5) != topicVersion) {
    setLastError(TopicMismatch);
    return;
  }
  const uint8_t nextOpinionValue = data[7];
  const uint8_t nextTriangleX = (len == kOpinionValueLength) ? data[8] : nextOpinionValue;
  const uint8_t nextTriangleY = (len == kOpinionValueLength) ? data[9] : 128;
  setOpinionState(nextOpinionValue, nextTriangleX, nextTriangleY, "gatt");
  neohexDisplay.startSyncBloom(colorForDisplayOpinion(), millis());
#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
  if (syncWindowActive) {
    syncWindowAwaitingOpinionSync = false;
    syncWindowOpinionSynced = true;
    gattDisconnectRequested = true;
    gattDisconnectAtMillis = millis() + kSyncOpinionDisconnectDelayMs;
  }
#endif
}

#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
class TopicConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    applyTopicConfig(characteristic->getData(), characteristic->getLength());
  }
};

class OpinionValueCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    applyOpinionValue(characteristic->getData(), characteristic->getLength());
  }
};

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    const uint8_t *data = characteristic->getData();
    const uint16_t len = characteristic->getLength();
    if (len != kCommandLength) {
      setLastError(InvalidLength);
      return;
    }
    if (data[0] != kLayoutVersion) {
      setLastError(UnsupportedLayoutVersion);
      return;
    }
    switch (data[1]) {
    case 0x01:
      resetHistogram();
      triggerStatusLedFlash(kStatusLedResetColor, StatusLed::kResetFlashMs);
      setLastError(NoError);
      break;
    case 0x02:
      exitSyncWindowRequested = true;
      setLastError(NoError);
      break;
    case 0x03:
      updateGattReadableValues(true);
      setLastError(NoError);
      break;
    default:
      setLastError(UnknownCommand);
      break;
    }
  }
};

class ReadableCallbacks : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic *characteristic) override {
    updateGattReadableValues(false);
    if (characteristic == histogramChar) {
      neohexDisplay.startPaletteOrbit(millis());
    }
  }
};

class BubbleWalkServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    handleConnect(server);
  }

  void onDisconnect(BLEServer *server) override {
    (void)server;
    handleDisconnect();
  }

#if defined(CONFIG_BLUEDROID_ENABLED)
  void onConnect(BLEServer *server, esp_ble_gatts_cb_param_t *param) override {
    handleConnect(server, param->connect.conn_id);
  }

  void onDisconnect(BLEServer *server, esp_ble_gatts_cb_param_t *param) override {
    (void)server;
    (void)param;
    handleDisconnect();
  }
#endif

#if defined(CONFIG_NIMBLE_ENABLED)
  void onConnect(BLEServer *server, ble_gap_conn_desc *desc) override {
    handleConnect(server, desc->conn_handle);
  }

  void onDisconnect(BLEServer *server, ble_gap_conn_desc *desc) override {
    (void)server;
    (void)desc;
    handleDisconnect();
  }
#endif

private:
  void handleConnect(BLEServer *server, uint16_t connId = 0) {
    const bool wasConnected = gattConnected;
    gattConnected = true;
    gattConnId = connId != 0 ? connId : (server != nullptr ? server->getConnId() : 0);
    gattConnIdValid = true;
    gattDisconnectRequested = false;
    if (syncWindowActive) {
      syncWindowAwaitingOpinionSync = true;
    }
    if (!wasConnected) {
      Serial.printf("sync_window=connected conn_id=%u\n", gattConnId);
      updateGattReadableValues(true);
    }
  }

  void handleDisconnect() {
    const bool wasConnected = gattConnected;
    gattConnected = false;
    gattConnIdValid = false;
    gattDisconnectRequested = false;
    gattDisconnectAtMillis = 0;
    if (wasConnected) {
      gattDisconnectedEvent = true;
      Serial.println("sync_window=disconnected");
    }
  }
};

static TopicConfigCallbacks topicConfigCallbacks;
static OpinionValueCallbacks opinionValueCallbacks;
static CommandCallbacks commandCallbacks;
static ReadableCallbacks readableCallbacks;
static BubbleWalkServerCallbacks serverCallbacks;
#endif

static void printCommandHelp() {
  Serial.println("commands: status | hist | reset | save | reboot | sync | encounter | number 1-7 | opinion 0-255 | brightness 0-255 | test | static | clear | help");
  Serial.printf("button_help=short_release_sync min_ms=%lu max_ms_exclusive=%lu long_release_encounter min_ms=%lu reset_hold_ms=%lu active_low=1\n",
                static_cast<unsigned long>(kButtonMinPressMs),
                static_cast<unsigned long>(kButtonLongPressMs),
                static_cast<unsigned long>(kButtonLongPressMs),
                static_cast<unsigned long>(kButtonResetPressMs));
}

static void printBootLog() {
  Serial.println();
  Serial.println("bubblewalk_nanoh2_neohex boot");
  Serial.printf("firmware=%u.%u.%u protocol=%u\n",
                kFirmwareMajor, kFirmwareMinor, kFirmwarePatch, kProtocolVersion);
  Serial.printf("node_id=%u device_number=%u role=%s role_flags=%u\n",
                currentNodeId(), deviceNumber, roleName(), roleFlags());
  Serial.printf("topic_id_hash=0x%08lX topic_version=%u opinion_value=%u triangle_xy=%u,%u\n",
                static_cast<unsigned long>(topicIdHash), topicVersion,
                opinionValue, triangleX, triangleY);
  Serial.printf("neohex_pin=G%u neohex_count=%u brightness=%u histogram_bins=%u\n",
                NEOHEX_PIN, NEOHEX_COUNT, brightness, histogramBinCount);
  Serial.printf("dedup_window_ms=%lu startup_mode=encounter sync_window_timeout_ms=%lu\n",
                static_cast<unsigned long>(DEDUP_WINDOW_MS),
                static_cast<unsigned long>(SYNC_WINDOW_TIMEOUT_MS));
  Serial.printf("button_pin=G%u button_actions=short_release_sync,long_%lums_release_encounter,hold_%lums_reset,release_after_reset_noop thresholds_ms=%lu,%lu,%lu active_low=1 input=edge_irq debounce_ms=%lu\n",
                NANO_H2_BUTTON_PIN,
                static_cast<unsigned long>(kButtonLongPressMs),
                static_cast<unsigned long>(kButtonResetPressMs),
                static_cast<unsigned long>(kButtonMinPressMs),
                static_cast<unsigned long>(kButtonLongPressMs),
                static_cast<unsigned long>(kButtonResetPressMs),
                static_cast<unsigned long>(kButtonDebounceMs));
  Serial.printf("serial_tx_timeout_ms=%lu serial_tx_buffer_size=%u\n",
                static_cast<unsigned long>(kSerialTxTimeoutMs),
                static_cast<unsigned>(kSerialTxBufferSize));
  Serial.printf("status_led=onboard_rgb brightness=%u boot=encounter sync=blue_blink_%lums awaiting_opinion=blue_blink_%lums encounter=green_pwm_step frame_ms=%lu level_range=%u-%u reset_indicator=white_blink_%lums_blue_on_%lums serial_reset=white_flash_%lums blue_led=sync_mirror\n",
                StatusLed::kBrightness,
                static_cast<unsigned long>(StatusLed::kSyncBlinkMs),
                static_cast<unsigned long>(StatusLed::kFastSyncBlinkMs),
                static_cast<unsigned long>(StatusLed::kFrameMs),
                StatusLed::kEncounterMinLevel,
                StatusLed::kEncounterMaxLevel,
                static_cast<unsigned long>(StatusLed::kResetIndicatorBlinkMs),
                static_cast<unsigned long>(StatusLed::kResetIndicatorMs),
                static_cast<unsigned long>(StatusLed::kResetFlashMs));
  Serial.printf("encounter_display=center_identity_pwm+rssi_rings center_pixel=%u center_pwm=green_pwm_step frame_ms=%lu step_per_frame=%u level_range=%u-%u period=half_status_led near_slots=%u middle_slots=%u far_slots=%u thresholds_dbm=%d,%d brightness_percent=%u,%u,%u,%u brightness_source=topic_config_as_100pct update=unique_peer_or_missing_display_or_level_change retention_minutes=%u empty_first=1 replace=random_in_full_ring\n",
                NeohexDisplay::kCenterPixel,
                static_cast<unsigned long>(NeohexDisplay::kFrameMs),
                NeohexDisplay::kCenterPulseStepPerFrame,
                NeohexDisplay::kCenterPulseMinLevel,
                NeohexDisplay::kCenterPulseMaxLevel,
                NeohexDisplay::kNearRingCount, NeohexDisplay::kMiddleRingCount, NeohexDisplay::kFarRingCount,
                static_cast<int>(NeohexDisplay::kNearRssiDbm), static_cast<int>(NeohexDisplay::kMiddleRssiDbm),
                NeohexDisplay::kCenterBrightnessPercent, NeohexDisplay::kNearRingBrightnessPercent,
                NeohexDisplay::kMiddleRingBrightnessPercent, NeohexDisplay::kFarRingBrightnessPercent, retentionMinutes);
  Serial.printf("neohex_animations=sync_bloom:%lums,encounter_pop:%lums,palette_orbit:%lums frame_ms=%lu blocking=0\n",
                static_cast<unsigned long>(NeohexDisplay::kSyncBloomDurationMs),
                static_cast<unsigned long>(NeohexDisplay::kEncounterPopDurationMs),
                static_cast<unsigned long>(NeohexDisplay::kPaletteOrbitDurationMs),
                static_cast<unsigned long>(NeohexDisplay::kFrameMs));
  printCommandHelp();
}

static void printStatus() {
  const RgbColor color = colorForDisplayOpinion();
  Serial.printf("status millis=%lu node_id=%u device_number=%u role=%s role_flags=%u topic_id_hash=0x%08lX topic_version=%u opinion_value=%u display_opinion_value=%.2f triangle_xy=%u,%u rgb=%u,%u,%u brightness=%u histogram_bins=%u unique_peer_count=%u packet_count=%u raw_packet_count=%u duplicate_packet_count=%u sync_window=%u gatt_connected=%u ble_mode=%u advertising_seq=%u last_error=%u button=%u test_mode=%u\n",
                static_cast<unsigned long>(millis()), currentNodeId(), deviceNumber, roleName(),
                roleFlags(), static_cast<unsigned long>(topicIdHash), topicVersion,
                opinionValue, displayOpinionValue, triangleX, triangleY,
                color.r, color.g, color.b, brightness, histogramBinCount,
                histogram.uniquePeerCount, histogram.packetCount, histogram.rawPacketCount,
                histogram.duplicatePacketCount,
#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
                syncWindowActive ? 1 : 0, gattConnected ? 1 : 0,
                participantBleMode,
#else
                0, 0, 0,
#endif
                advSeq, lastError, digitalRead(NANO_H2_BUTTON_PIN), pixelTestMode);
}

static void printHistogramSummary() {
  Serial.printf("hist topic_id_hash=0x%08lX topic_version=%u histogram_bins=%u unique_peer_count=%u packet_count=%u raw_packet_count=%u duplicate_packet_count=%u bins=",
                static_cast<unsigned long>(topicIdHash), topicVersion, histogramBinCount,
                histogram.uniquePeerCount, histogram.packetCount, histogram.rawPacketCount,
                histogram.duplicatePacketCount);
  for (uint8_t i = 0; i < histogramBinCount; i++) {
    if (i > 0) {
      Serial.print(",");
    }
    Serial.print(histogram.bins[i]);
  }
  Serial.printf(" first_seen_millis=%lu last_seen_millis=%lu flags=%u\n",
                static_cast<unsigned long>(histogram.firstSeenMillis),
                static_cast<unsigned long>(histogram.lastSeenMillis),
                histogram.overflow ? 1 : 0);
}

static void printEncounterLog(const EncounterPayload &payload,
                              int rssi,
                              const String &address,
                              bool duplicate) {
  Serial.printf("encounter millis=%lu node_id=%u topic_id_hash=0x%08lX opinion_value=%u triangle_xy=%u,%u rssi=%d seq=%u duplicate=%u address=%s\n",
                static_cast<unsigned long>(millis()), payload.nodeId,
                static_cast<unsigned long>(payload.topicIdHash),
                payload.opinionValue, payload.triangleX, payload.triangleY,
                rssi, payload.seq, duplicate ? 1 : 0, address.c_str());
}

#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
static void setupBubbleWalkGatt() {
  if (bleServer == nullptr) {
    return;
  }
  bubbleWalkService = bleServer->createService(BLEUUID(kGattServiceUuid), 18);

  topicConfigChar = bubbleWalkService->createCharacteristic(
      kTopicConfigUuid, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  topicConfigChar->setCallbacks(&topicConfigCallbacks);

  opinionValueChar = bubbleWalkService->createCharacteristic(
      kOpinionValueUuid, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  opinionValueChar->setCallbacks(&opinionValueCallbacks);

  deviceStatusChar = bubbleWalkService->createCharacteristic(
      kDeviceStatusUuid, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  deviceStatusChar->setCallbacks(&readableCallbacks);

  histogramChar = bubbleWalkService->createCharacteristic(kHistogramUuid, BLECharacteristic::PROPERTY_READ);
  histogramChar->setCallbacks(&readableCallbacks);

  commandChar = bubbleWalkService->createCharacteristic(
      kCommandUuid, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  commandChar->setCallbacks(&commandCallbacks);

  encounterSamplesChar = bubbleWalkService->createCharacteristic(
      kEncounterSamplesUuid, BLECharacteristic::PROPERTY_READ);
  encounterSamplesChar->setCallbacks(&readableCallbacks);

  bubbleWalkService->start();
  gattServiceReady = true;
  updateGattReadableValues(false);
  Serial.printf("gatt_service=ready uuid=%s\n", kGattServiceUuid);
}

static void refreshAdvertisingData() {
  if (bleAdvertising == nullptr || syncWindowActive || gattConnected) {
    return;
  }
  const EncounterPayload payload = makeEncounterPayload(++advSeq);
  BLEAdvertisementData advertisementData;
  advertisementData.setFlags(ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT);
  advertisementData.setManufacturerData(
      String(reinterpret_cast<const char *>(&payload), sizeof(payload)));
  BLEAdvertisementData scanResponseData;
  scanResponseData.setName(String(bleName));

  bleAdvertising->stop();
  bleAdvertising->setAdvertisementData(advertisementData);
  bleAdvertising->setScanResponseData(scanResponseData);
  bleAdvertising->setScanResponse(true);
  bleAdvertising->setMinInterval(0x00A0);
  bleAdvertising->setMaxInterval(0x00F0);
  if (bleAdvertising->start()) {
    advertisingPayloadDirty = false;
    lastAdvertiseRefreshMillis = millis();
    updateGattReadableValues(false);
    Serial.printf("advertising millis=%lu node_id=%u topic_id_hash=0x%08lX opinion_value=%u triangle_xy=%u,%u seq=%u payload_len=%u\n",
                  static_cast<unsigned long>(millis()), currentNodeId(),
                  static_cast<unsigned long>(topicIdHash), opinionValue,
                  triangleX, triangleY, advSeq, static_cast<unsigned>(sizeof(payload)));
  } else {
    setLastError(BleOperationFailed);
    Serial.println("advertising=failed");
  }
}
#endif

#if defined(ROLE_SCANNER)
class BubbleWalkAdvertisedDeviceCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    if (!advertisedDevice.haveManufacturerData()) {
      return;
    }

    EncounterPayload payload{};
    if (!parseEncounterPayload(advertisedDevice.getManufacturerData(), &payload)) {
      return;
    }
    if (payload.topicIdHash != topicIdHash || payload.nodeId == currentNodeId()) {
      return;
    }

    const uint32_t seenAtMillis = millis();
    const bool shouldAdd = shouldAddHistogramSample(payload, seenAtMillis);
    const String address = advertisedDevice.getAddress().toString();
    printEncounterLog(payload, advertisedDevice.getRSSI(), address, !shouldAdd);
    if (shouldAdd) {
      addHistogramSample(payload, advertisedDevice.getRSSI(), seenAtMillis);
    }
  }
};

static BubbleWalkAdvertisedDeviceCallbacks scannerCallbacks;
#endif

#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
static void startEncounterScanning() {
#if defined(ROLE_SCANNER)
  if (bleScan == nullptr || syncWindowActive || gattConnected) {
    return;
  }
  bleScan->setAdvertisedDeviceCallbacks(&scannerCallbacks);
  bleScan->setActiveScan(false);
  bleScan->setInterval(100);
  bleScan->setWindow(50);
  Serial.println("scanner=started interval=100 window=50 duration_s=1");
#endif
}

static void updateBleScanner() {
#if defined(ROLE_SCANNER)
  if (bleScan == nullptr || syncWindowActive || gattConnected) {
    return;
  }
#if ROLE_IS_PARTICIPANT
  if (participantBleMode != ParticipantBleScanning) {
    return;
  }
#endif
  BLEScanResults *results = bleScan->start(1, false);
  if (results != nullptr) {
    Serial.printf("scan_done millis=%lu found=%d\n",
                  static_cast<unsigned long>(millis()), results->getCount());
  }
  bleScan->clearResults();
#endif
}

static void updateBleAdvertiser() {
#if defined(ROLE_ADVERTISER)
  if (syncWindowActive || gattConnected) {
    return;
  }
#if ROLE_IS_PARTICIPANT
  if (participantBleMode != ParticipantBleAdvertising) {
    return;
  }
#endif
  const uint32_t now = millis();
  if (advertisingPayloadDirty || now - lastAdvertiseRefreshMillis >= BLE_PAYLOAD_UPDATE_MS) {
    refreshAdvertisingData();
  }
#endif
}

static uint32_t nextParticipantPhaseDuration(ParticipantBleMode mode) {
  const uint32_t baseMs =
      (mode == ParticipantBleAdvertising) ? PARTICIPANT_ADV_WINDOW_MS : PARTICIPANT_SCAN_WINDOW_MS;
  const uint32_t phaseIndex = participantPhaseCounter++;
#if PARTICIPANT_PHASE_JITTER_MS > 0
  const uint32_t nodeTerm = static_cast<uint32_t>(currentNodeId()) * 73UL;
  const uint32_t phaseTerm = phaseIndex * (static_cast<uint32_t>(currentNodeId()) * 41UL + 97UL);
  const uint32_t modeTerm = (mode == ParticipantBleAdvertising) ? 131UL : 263UL;
  return baseMs + ((nodeTerm + phaseTerm + modeTerm) % PARTICIPANT_PHASE_JITTER_MS);
#else
  return baseMs;
#endif
}

static void startParticipantAdvertisingPhase(uint32_t durationMs) {
#if ROLE_IS_PARTICIPANT
  if (syncWindowActive || gattConnected) {
    return;
  }
  if (bleAdvertising != nullptr) {
    bleAdvertising->stop();
  }
  participantBleMode = ParticipantBleAdvertising;
  participantNextSwitchMillis = millis() + (durationMs == 0 ? 1 : durationMs);
  advertisingPayloadDirty = true;
  Serial.printf("participant_phase=advertising duration_ms=%lu\n",
                static_cast<unsigned long>(durationMs));
  refreshAdvertisingData();
#else
  (void)durationMs;
#endif
}

static void startParticipantScanningPhase(uint32_t durationMs) {
#if ROLE_IS_PARTICIPANT
  if (syncWindowActive || gattConnected) {
    return;
  }
  if (bleAdvertising != nullptr) {
    bleAdvertising->stop();
  }
  participantBleMode = ParticipantBleScanning;
  participantNextSwitchMillis = millis() + (durationMs == 0 ? 1 : durationMs);
  Serial.printf("participant_phase=scanning duration_ms=%lu\n",
                static_cast<unsigned long>(durationMs));
  startEncounterScanning();
#else
  (void)durationMs;
#endif
}

static void startParticipantBleRoles() {
#if ROLE_IS_PARTICIPANT
  participantPhaseCounter = 0;
  normalBleRolesRunning = true;
  if ((currentNodeId() % 3) == 2) {
    startParticipantScanningPhase(nextParticipantPhaseDuration(ParticipantBleScanning));
  } else {
    startParticipantAdvertisingPhase(nextParticipantPhaseDuration(ParticipantBleAdvertising));
  }
#endif
}

static void updateParticipantBlePhase() {
#if ROLE_IS_PARTICIPANT
  if (syncWindowActive || gattConnected || !normalBleRolesRunning ||
      participantBleMode == ParticipantBleIdle) {
    return;
  }
  if (static_cast<int32_t>(millis() - participantNextSwitchMillis) < 0) {
    return;
  }
  if (participantBleMode == ParticipantBleAdvertising) {
    startParticipantScanningPhase(nextParticipantPhaseDuration(ParticipantBleScanning));
  } else {
    startParticipantAdvertisingPhase(nextParticipantPhaseDuration(ParticipantBleAdvertising));
  }
#endif
}

static void stopNormalBleRoles() {
  if (bleAdvertising != nullptr) {
    bleAdvertising->stop();
  }
  participantBleMode = ParticipantBleIdle;
  participantNextSwitchMillis = 0;
  participantPhaseCounter = 0;
  normalBleRolesRunning = false;
}

static void startNormalBleRoles() {
  if (syncWindowActive || gattConnected) {
    return;
  }
#if ROLE_IS_PARTICIPANT
  startParticipantBleRoles();
  return;
#endif
  bool started = false;
#if defined(ROLE_ADVERTISER)
  refreshAdvertisingData();
  started = true;
#endif
#if defined(ROLE_SCANNER)
  startEncounterScanning();
  started = true;
#endif
  normalBleRolesRunning = started;
}

static void startSyncWindow(const char *reason, uint32_t timeoutMs) {
  if (!gattServiceReady || bleAdvertising == nullptr) {
    Serial.println("sync_window=failed reason=gatt_not_ready");
    setLastError(BleOperationFailed);
    return;
  }
  stopNormalBleRoles();
  syncWindowActive = true;
  syncWindowAwaitingOpinionSync = false;
  syncWindowOpinionSynced = false;
  syncWindowDeadlineMillis = millis() + timeoutMs;
  pixelTestMode = false;
  lastDeviceNumberDisplayMillis = 0;
  const uint8_t numberBrightness =
      brightness < kDeviceNumberDisplayMinBrightness
          ? kDeviceNumberDisplayMinBrightness
          : brightness;
  neohexDisplay.showDeviceNumber(deviceNumber, kDeviceNumberColor,
                                 numberBrightness);
  updateGattReadableValues(false);

  BLEAdvertisementData advertisementData;
  advertisementData.setFlags(ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT);
  advertisementData.setCompleteServices(BLEUUID(kGattServiceUuid));
  advertisementData.setName(String(blePickerName));
  BLEAdvertisementData scanResponseData;
  scanResponseData.setName(String(bleName));

  bleAdvertising->stop();
  bleAdvertising->setAdvertisementData(advertisementData);
  bleAdvertising->setScanResponseData(scanResponseData);
  bleAdvertising->setScanResponse(true);
  bleAdvertising->setMinInterval(0x00A0);
  bleAdvertising->setMaxInterval(0x00F0);
  if (bleAdvertising->start()) {
    Serial.printf("sync_window=started reason=%s timeout_ms=%lu name=%s\n",
                  reason, static_cast<unsigned long>(timeoutMs), bleName);
  } else {
    syncWindowActive = false;
    setLastError(BleOperationFailed);
    Serial.println("sync_window=failed");
    startNormalBleRoles();
  }
}

static void closeSyncWindow(const char *reason) {
  if (!syncWindowActive && normalBleRolesRunning) {
    return;
  }
  syncWindowActive = false;
  syncWindowAwaitingOpinionSync = false;
  syncWindowOpinionSynced = false;
  gattDisconnectRequested = false;
  gattDisconnectAtMillis = 0;
  syncWindowDeadlineMillis = 0;
  updateGattReadableValues(false);
  if (gattConnected) {
    Serial.printf("sync_window=closing reason=%s deferred=disconnect\n", reason);
    return;
  }
  if (bleAdvertising != nullptr) {
    bleAdvertising->stop();
  }
  Serial.printf("sync_window=closed reason=%s\n", reason);
  startNormalBleRoles();
}

static void updateSyncWindow() {
  if (exitSyncWindowRequested) {
    exitSyncWindowRequested = false;
    closeSyncWindow("command");
  }
  if (gattDisconnectRequested &&
      static_cast<int32_t>(millis() - gattDisconnectAtMillis) >= 0) {
    gattDisconnectRequested = false;
    gattDisconnectAtMillis = 0;
    if (gattConnected && bleServer != nullptr && gattConnIdValid) {
      Serial.printf("sync_window=gatt_disconnect reason=opinion_sync conn_id=%u\n", gattConnId);
      bleServer->disconnect(gattConnId);
    } else if (syncWindowActive && syncWindowOpinionSynced) {
      closeSyncWindow("opinion_sync");
    }
  }
  if (gattDisconnectedEvent) {
    gattDisconnectedEvent = false;
    if (syncWindowActive) {
      if (syncWindowOpinionSynced) {
        closeSyncWindow("opinion_sync");
      } else if (syncWindowAwaitingOpinionSync) {
        Serial.println("sync_window=disconnected awaiting_opinion_sync=1");
      } else {
        closeSyncWindow("disconnect");
      }
    } else if (!normalBleRolesRunning) {
      startNormalBleRoles();
    }
  }
  if (syncWindowActive && !gattConnected &&
      static_cast<int32_t>(millis() - syncWindowDeadlineMillis) >= 0) {
    closeSyncWindow("timeout");
  }
}
#else
static void updateBleScanner() {}
static void updateBleAdvertiser() {}
static void updateParticipantBlePhase() {}
static void updateSyncWindow() {}
static void startSyncWindow(const char *reason, uint32_t timeoutMs) {
  (void)reason;
  (void)timeoutMs;
  Serial.println("sync_window=unavailable");
}
static void closeSyncWindow(const char *reason) {
  (void)reason;
}
static void startNormalBleRoles() {}
static void stopNormalBleRoles() {}
#endif

static bool parseByteArgument(const String &line, const char *prefix, uint8_t *out) {
  if (!line.startsWith(prefix)) {
    return false;
  }
  const int start = strlen(prefix);
  if (line.length() <= start || line.charAt(start) != ' ') {
    return false;
  }
  const long value = line.substring(start + 1).toInt();
  if (value < 0 || value > 255) {
    Serial.println("error=value_out_of_range");
    return true;
  }
  *out = static_cast<uint8_t>(value);
  return true;
}

static bool parseBareByte(const String &line, uint8_t *out) {
  if (line.length() == 0) {
    return false;
  }
  for (uint16_t i = 0; i < line.length(); i++) {
    if (!isDigit(line.charAt(i))) {
      return false;
    }
  }
  const long value = line.toInt();
  if (value < 0 || value > 255) {
    return false;
  }
  *out = static_cast<uint8_t>(value);
  return true;
}

static void handleCommand(String line) {
  line.trim();
  line.toLowerCase();
  if (line.length() == 0) {
    return;
  }

  uint8_t value = 0;
  if (line == "status") {
    updateGattReadableValues(false);
    printStatus();
  } else if (line == "hist") {
    updateGattReadableValues(false);
    printHistogramSummary();
  } else if (line == "reset") {
    resetHistogram();
    triggerStatusLedFlash(kStatusLedResetColor, StatusLed::kResetFlashMs);
  } else if (line == "save") {
    saveFlashHistogramSnapshot();
  } else if (line == "reboot") {
    Serial.println("rebooting=1");
    Serial.flush();
    delay(50);
    ESP.restart();
  } else if (line == "sync") {
    startSyncWindow("serial", SYNC_WINDOW_TIMEOUT_MS);
  } else if (line == "encounter") {
    closeSyncWindow("serial");
  } else if (line == "help") {
    printCommandHelp();
  } else if (parseByteArgument(line, "number", &value)) {
    if (saveDeviceNumber(value)) {
      Serial.printf("device_number=saved value=%u rebooting=1\n", deviceNumber);
      Serial.flush();
      delay(50);
      ESP.restart();
    }
  } else if (parseByteArgument(line, "opinion", &value) || parseBareByte(line, &value)) {
    pixelTestMode = false;
    setOpinionState(value, value, 128, "serial");
  } else if (parseByteArgument(line, "brightness", &value)) {
    brightness = value;
    renderDisplay();
    updateGattReadableValues(true);
    printStatus();
  } else if (line == "test") {
    pixelTestMode = true;
    neohexDisplay.resetPixelTest();
    showPixelTestStep();
    printStatus();
  } else if (line == "static") {
    pixelTestMode = false;
    renderDisplay();
    printStatus();
  } else if (line == "clear") {
    pixelTestMode = false;
    neohexDisplay.clearPixels();
    printStatus();
  } else {
    Serial.printf("error=unknown_command command=\"%s\"\n", line.c_str());
  }
}

static void pollSerial() {
  while (Serial.available() > 0) {
    const char c = static_cast<char>(Serial.read());
    if (c == '\r') {
      continue;
    }
    if (c == '\n') {
      handleCommand(serialLine);
      serialLine = "";
      continue;
    }
    if (serialLine.length() < 128) {
      serialLine += c;
    }
  }
}

static uint8_t IRAM_ATTR nextButtonEdgeIndex(uint8_t index) {
  index++;
  return index >= kButtonEdgeQueueSize ? 0 : index;
}

static void IRAM_ATTR handleButtonEdgeInterrupt() {
  const uint32_t now = pdTICKS_TO_MS(xTaskGetTickCountFromISR());
  if (now - buttonLastQueuedEdgeMillis < kButtonIsrMinEdgeMs) {
    return;
  }
  buttonLastQueuedEdgeMillis = now;

  const bool pressed = gpio_get_level(static_cast<gpio_num_t>(NANO_H2_BUTTON_PIN)) == 0;
  const uint8_t nextHead = nextButtonEdgeIndex(buttonEdgeHead);
  if (nextHead == buttonEdgeTail) {
    buttonEdgeDroppedCount = static_cast<uint16_t>(buttonEdgeDroppedCount + 1);
    return;
  }

  buttonEdgeQueue[buttonEdgeHead].pressed = pressed;
  buttonEdgeQueue[buttonEdgeHead].atMillis = now;
  buttonEdgeHead = nextHead;
}

static bool popButtonEdge(ButtonEdgeEvent *event) {
  noInterrupts();
  if (buttonEdgeTail == buttonEdgeHead) {
    interrupts();
    return false;
  }

  event->pressed = buttonEdgeQueue[buttonEdgeTail].pressed;
  event->atMillis = buttonEdgeQueue[buttonEdgeTail].atMillis;
  buttonEdgeTail = nextButtonEdgeIndex(buttonEdgeTail);
  interrupts();
  return true;
}

static void setupButtonInput() {
  buttonStablePressed = digitalRead(NANO_H2_BUTTON_PIN) == LOW;
  buttonPressedStartedMillis = millis();
  buttonLastAcceptedEdgeMillis = buttonPressedStartedMillis;
  buttonLastQueuedEdgeMillis = buttonPressedStartedMillis;
  attachInterrupt(digitalPinToInterrupt(NANO_H2_BUTTON_PIN), handleButtonEdgeInterrupt, CHANGE);
}

static void handleButtonRelease(uint32_t durationMs) {
  if (buttonResetTriggeredDuringPress) {
    Serial.printf("button_action=reset_already_done duration_ms=%lu\n", static_cast<unsigned long>(durationMs));
    buttonResetTriggeredDuringPress = false;
    printStatus();
    return;
  }

  if (durationMs < kButtonMinPressMs) {
    Serial.printf("button_action=ignored duration_ms=%lu\n", static_cast<unsigned long>(durationMs));
    return;
  }

  if (durationMs >= kButtonResetPressMs) {
    resetHistogram();
    saveFlashHistogramSnapshot();
    startStatusLedResetIndicator();
    Serial.printf("button_action=reset_histogram duration_ms=%lu trigger=release_fallback indicator=white_blink_%lums blue_led=on indicator_ms=%lu\n",
                  static_cast<unsigned long>(durationMs),
                  static_cast<unsigned long>(StatusLed::kResetIndicatorBlinkMs),
                  static_cast<unsigned long>(StatusLed::kResetIndicatorMs));
    printStatus();
    return;
  }

  if (durationMs >= kButtonLongPressMs) {
    closeSyncWindow("button");
    Serial.printf("button_action=encounter duration_ms=%lu\n", static_cast<unsigned long>(durationMs));
    printStatus();
    return;
  }

  startSyncWindow("button", SYNC_WINDOW_TIMEOUT_MS);
  Serial.printf("button_action=sync duration_ms=%lu\n", static_cast<unsigned long>(durationMs));
  printStatus();
}

static void updateButtonResetHoldAction() {
  if (!buttonStablePressed || buttonResetTriggeredDuringPress) {
    return;
  }

  const uint32_t now = millis();
  const uint32_t durationMs = now - buttonPressedStartedMillis;
  if (durationMs >= kButtonResetPressMs) {
    buttonResetTriggeredDuringPress = true;
    resetHistogram();
    saveFlashHistogramSnapshot();
    startStatusLedResetIndicator();
    Serial.printf("button_action=reset_histogram duration_ms=%lu trigger=hold_threshold indicator=white_blink_%lums blue_led=on indicator_ms=%lu\n",
                  static_cast<unsigned long>(durationMs),
                  static_cast<unsigned long>(StatusLed::kResetIndicatorBlinkMs),
                  static_cast<unsigned long>(StatusLed::kResetIndicatorMs));
    printStatus();
  }
}

static void updateButton() {
  ButtonEdgeEvent event{};
  while (popButtonEdge(&event)) {
    if (event.pressed == buttonStablePressed ||
        event.atMillis - buttonLastAcceptedEdgeMillis < kButtonDebounceMs) {
      continue;
    }

    buttonStablePressed = event.pressed;
    buttonLastAcceptedEdgeMillis = event.atMillis;
    if (buttonStablePressed) {
      buttonPressedStartedMillis = event.atMillis;
      buttonResetTriggeredDuringPress = false;
      Serial.println("button_event=pressed");
      continue;
    }

    const uint32_t durationMs = event.atMillis - buttonPressedStartedMillis;
    Serial.printf("button_event=released duration_ms=%lu\n", static_cast<unsigned long>(durationMs));
    handleButtonRelease(durationMs);
  }
  updateButtonResetHoldAction();
}

static void setupBle() {
#if defined(ROLE_ADVERTISER) || defined(ROLE_SCANNER)
  snprintf(bleName, sizeof(bleName), "BubbleWalk %u", deviceNumber);
  snprintf(blePickerName, sizeof(blePickerName), "Device %u", deviceNumber);
  if (!BLEDevice::init(String(bleName))) {
    Serial.println("ble_init=failed");
    setLastError(BleOperationFailed);
    return;
  }
#if defined(CONFIG_NIMBLE_ENABLED)
  if (!setupBubbleWalkBleIdentity()) {
    setLastError(BleOperationFailed);
    return;
  }
#endif
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(&serverCallbacks);
  bleServer->advertiseOnDisconnect(false);
  setupBubbleWalkGatt();
  bleAdvertising = BLEDevice::getAdvertising();
#if defined(ROLE_SCANNER)
  bleScan = BLEDevice::getScan();
#endif
  Serial.printf("ble_name=%s picker_name=%s\n", bleName, blePickerName);
  Serial.println("startup_state=encounter sync_window=button_short_press normal_ble_roles=started");
  startNormalBleRoles();
#endif
}

void setup() {
  pinMode(NANO_H2_BUTTON_PIN, INPUT_PULLUP);
  statusLed.begin();
  setupButtonInput();

  Serial.begin(115200);
#if ARDUINO_USB_MODE && ARDUINO_USB_CDC_ON_BOOT
  Serial.setTxBufferSize(kSerialTxBufferSize);
  Serial.setTxTimeoutMs(kSerialTxTimeoutMs);
#else
  Serial.setTxBufferSize(kSerialTxBufferSize);
#endif
  const uint32_t serialWaitStart = millis();
  while (!Serial && millis() - serialWaitStart < 2000) {
    delay(10);
  }

  resetTopicChoiceRgbFromGradient();
  setupDeviceIdentity();
  neohexDisplay.begin();
  setupFlashHistogramSnapshot();
  setupDeviceNumber();
  if (!loadFlashHistogramSnapshot()) {
    resetHistogram();
  }
  printBootLog();
  printStatus();
  setupBle();
}

void loop() {
  pollSerial();
  updateButton();
  updateStatusLed();
  updateSyncWindow();
  updateParticipantBlePhase();
  updateBleAdvertiser();
  updateBleScanner();
  updateFlashHistogramSnapshot();
  updateNeohexCenterPulse();

  const uint32_t now = millis();
  if (pixelTestMode && now - lastPixelTestMillis >= 120) {
    lastPixelTestMillis = now;
    showPixelTestStep();
  }
  if (now - lastStatusMillis >= 5000) {
    lastStatusMillis = now;
    printStatus();
  }
}
