#pragma once

#include <Adafruit_NeoPixel.h>
#include <Arduino.h>

#include "bubblewalk/color.h"

namespace bubblewalk {

class StatusLed {
public:
  static constexpr uint8_t kBrightness = 255;
  static constexpr uint32_t kSyncBlinkMs = 300;
  static constexpr uint32_t kFastSyncBlinkMs = 100;
  static constexpr uint32_t kFrameMs = 8;
  static constexpr uint32_t kResetFlashMs = 900;
  static constexpr uint32_t kResetIndicatorMs = 3000;
  static constexpr uint32_t kResetIndicatorBlinkMs = 100;
  static constexpr uint8_t kEncounterMinLevel = 8;
  static constexpr uint8_t kEncounterMaxLevel = 255;

  StatusLed();

  void begin();
  void update(bool syncActive, bool fastSyncActive, bool encounterActive,
              uint32_t now);
  void flash(RgbColor color, uint32_t durationMs, uint32_t now);
  void startResetIndicator(uint32_t now);

private:
  void show(RgbColor color);
  static void stepPulse(uint8_t &level, int8_t &direction, uint8_t minLevel,
                        uint8_t maxLevel);

  Adafruit_NeoPixel rgb_;
  bool on_ = false;
  bool lastSyncActive_ = false;
  bool lastEncounterActive_ = false;
  uint8_t encounterLevel_ = kEncounterMinLevel;
  int8_t encounterDirection_ = 1;
  uint32_t lastFrameMillis_ = 0;
  uint32_t flashUntilMillis_ = 0;
  RgbColor flashColor_ = {0, 0, 0};
  uint32_t resetIndicatorUntilMillis_ = 0;
  bool resetIndicatorOn_ = false;
  uint32_t lastResetIndicatorBlinkMillis_ = 0;
};

} // namespace bubblewalk
