#pragma once

#include <Adafruit_NeoPixel.h>
#include <Arduino.h>

#include "bubblewalk/color.h"

#ifndef NEOHEX_ENCOUNTER_RSSI_NEAR_DBM
#define NEOHEX_ENCOUNTER_RSSI_NEAR_DBM -55
#endif

#ifndef NEOHEX_ENCOUNTER_RSSI_MIDDLE_DBM
#define NEOHEX_ENCOUNTER_RSSI_MIDDLE_DBM -70
#endif

namespace bubblewalk {

enum class EncounterDistanceLevel : uint8_t { Near = 0, Middle = 1, Far = 2 };

struct EncounterDisplayUpdate {
  bool slotMissing = false;
  bool levelChanged = false;
  bool placed = false;
  bool usedEmptyPixel = false;
  uint8_t pixel = 0;
  uint8_t brightnessPercent = 0;
  uint8_t storedCount = 0;
  bool overflow = false;
  EncounterDistanceLevel level = EncounterDistanceLevel::Far;
};

class NeohexDisplay {
public:
  static constexpr uint8_t kPixelCount = 37;
  static constexpr uint8_t kCenterPixel = 18;
  static constexpr uint8_t kNearRingCount = 6;
  static constexpr uint8_t kMiddleRingCount = 12;
  static constexpr uint8_t kFarRingCount = 18;
  static constexpr uint8_t kCenterBrightnessPercent = 100;
  static constexpr uint8_t kNearRingBrightnessPercent = 50;
  static constexpr uint8_t kMiddleRingBrightnessPercent = 30;
  static constexpr uint8_t kFarRingBrightnessPercent = 10;
  static constexpr uint32_t kFrameMs = 16;
  static constexpr uint8_t kCenterPulseStepPerFrame = 4;
  static constexpr uint8_t kCenterPulseMinLevel = 64;
  static constexpr uint8_t kCenterPulseMaxLevel = 255;
  static constexpr uint32_t kSyncBloomDurationMs = 1100;
  static constexpr uint32_t kEncounterPopDurationMs = 760;
  static constexpr uint32_t kPaletteOrbitDurationMs = 2200;
  static constexpr int8_t kNearRssiDbm = NEOHEX_ENCOUNTER_RSSI_NEAR_DBM;
  static constexpr int8_t kMiddleRssiDbm = NEOHEX_ENCOUNTER_RSSI_MIDDLE_DBM;

  NeohexDisplay();

  void begin();
  void render(RgbColor ownerColor, uint8_t brightness,
              uint16_t retentionMinutes, uint32_t now);
  void update(RgbColor ownerColor, uint8_t brightness,
              uint16_t retentionMinutes, uint32_t now);
  void clearPixels();
  void clearEncounters();
  void resetPixelTest() { testPixelIndex_ = 0; }
  void showPixelTestStep(RgbColor color, uint8_t brightness);
  void showDeviceNumber(uint8_t number, RgbColor color, uint8_t brightness);

  EncounterDisplayUpdate observeEncounter(
      RgbColor color, uint8_t nodeId, uint16_t sequence, int8_t rssi,
      uint32_t seenAtMillis, uint16_t retentionMinutes, bool forcePlacement,
      bool animate);
  EncounterDisplayUpdate restoreEncounter(
      RgbColor color, uint8_t nodeId, uint16_t sequence, int8_t rssi,
      uint32_t seenAtMillis);

  void startSyncBloom(RgbColor color, uint32_t now);
  void startPaletteOrbit(uint32_t now);

  uint8_t storedCount() const { return storedCount_; }
  bool overflowed() const { return overflow_; }
  static const char *distanceName(EncounterDistanceLevel level);

private:
  struct Slot {
    RgbColor color;
    uint8_t nodeId;
    uint16_t sequence;
    uint32_t seenAtMillis;
    EncounterDistanceLevel level;
    bool valid;
  };

  enum class AnimationKind : uint8_t { None, SyncBloom, EncounterPop, PaletteOrbit };

  struct AnimationState {
    AnimationKind kind;
    uint32_t startedAtMillis;
    uint32_t durationMillis;
    RgbColor color;
    uint8_t targetPixel;
    EncounterDistanceLevel targetLevel;
    RgbColor palette[kPixelCount - 1];
    uint8_t paletteCount;
  };

  static EncounterDistanceLevel distanceLevelForRssi(int8_t rssi);
  static const uint8_t *ringPixels(EncounterDistanceLevel level);
  static uint8_t ringCount(EncounterDistanceLevel level);
  static uint8_t brightnessPercentForPixel(uint8_t pixel);
  static void stepPulse(uint8_t &level, int8_t &direction, uint8_t minLevel,
                        uint8_t maxLevel);

  void expireSlots(uint32_t now, uint16_t retentionMinutes);
  int8_t findSlotForNode(uint8_t nodeId) const;
  void clearSlot(uint8_t pixel);
  uint8_t pickPixel(EncounterDistanceLevel level, bool *usedEmptyPixel) const;
  EncounterDisplayUpdate placeEncounter(
      RgbColor color, uint8_t nodeId, uint16_t sequence,
      EncounterDistanceLevel level, uint32_t seenAtMillis, bool animate,
      bool slotMissing, bool levelChanged, uint32_t now);
  void startEncounterPop(RgbColor color, uint8_t pixel,
                         EncounterDistanceLevel level, uint32_t now);
  void renderAnimationOverlay(uint32_t now);
  void setAnimationPixel(uint8_t pixel, RgbColor color, uint8_t level);
  void renderPaletteRing(const uint8_t *pixels, uint8_t count, uint8_t phase,
                         uint8_t level);
  static bool paletteContains(const AnimationState &state, RgbColor color);

  Adafruit_NeoPixel pixels_;
  Slot slots_[kPixelCount] = {};
  uint8_t storedCount_ = 0;
  bool overflow_ = false;
  AnimationState animation_ = {};
  uint8_t centerPulseLevel_ = kCenterPulseMinLevel;
  int8_t centerPulseDirection_ = 1;
  uint32_t lastFrameMillis_ = 0;
  uint8_t testPixelIndex_ = 0;
};

} // namespace bubblewalk
