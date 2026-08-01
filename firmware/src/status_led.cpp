#include "bubblewalk/status_led.h"

#ifndef NANO_H2_BLUE_LED_PIN
#define NANO_H2_BLUE_LED_PIN 4
#endif

#ifndef NANO_H2_RGB_POWER_PIN
#define NANO_H2_RGB_POWER_PIN 10
#endif

#ifndef NANO_H2_RGB_DATA_PIN
#define NANO_H2_RGB_DATA_PIN 11
#endif

namespace bubblewalk {
namespace {

constexpr RgbColor kOff = {0, 0, 0};
constexpr RgbColor kSyncColor = {0, 0, 255};
constexpr RgbColor kEncounterColor = {0, 96, 0};
constexpr RgbColor kResetColor = {255, 255, 255};

} // namespace

StatusLed::StatusLed()
    : rgb_(1, NANO_H2_RGB_DATA_PIN, NEO_GRB + NEO_KHZ800) {}

void StatusLed::begin() {
  pinMode(NANO_H2_BLUE_LED_PIN, OUTPUT);
  pinMode(NANO_H2_RGB_POWER_PIN, OUTPUT);
  digitalWrite(NANO_H2_RGB_POWER_PIN, HIGH);
  rgb_.begin();
  show(kOff);
  digitalWrite(NANO_H2_BLUE_LED_PIN, LOW);
}

void StatusLed::show(RgbColor color) {
  rgb_.setBrightness(kBrightness);
  rgb_.setPixelColor(0, rgb_.Color(color.r, color.g, color.b));
  rgb_.show();
}

void StatusLed::stepPulse(uint8_t &level, int8_t &direction, uint8_t minLevel,
                          uint8_t maxLevel) {
  if (direction > 0) {
    if (level >= maxLevel) {
      direction = -1;
      level--;
    } else {
      level++;
    }
  } else if (level <= minLevel) {
    direction = 1;
    level++;
  } else {
    level--;
  }
}

void StatusLed::flash(RgbColor color, uint32_t durationMs, uint32_t now) {
  flashColor_ = color;
  flashUntilMillis_ = now + durationMs;
  show(color);
  digitalWrite(NANO_H2_BLUE_LED_PIN, LOW);
}

void StatusLed::startResetIndicator(uint32_t now) {
  resetIndicatorUntilMillis_ = now + kResetIndicatorMs;
  resetIndicatorOn_ = true;
  lastResetIndicatorBlinkMillis_ = now;
  show(kResetColor);
  digitalWrite(NANO_H2_BLUE_LED_PIN, HIGH);
}

void StatusLed::update(bool syncActive, bool fastSyncActive,
                       bool encounterActive, uint32_t now) {
  if (resetIndicatorUntilMillis_ != 0) {
    if (static_cast<int32_t>(resetIndicatorUntilMillis_ - now) > 0) {
      if (now - lastResetIndicatorBlinkMillis_ >= kResetIndicatorBlinkMs) {
        lastResetIndicatorBlinkMillis_ = now;
        resetIndicatorOn_ = !resetIndicatorOn_;
        show(resetIndicatorOn_ ? kResetColor : kOff);
      }
      digitalWrite(NANO_H2_BLUE_LED_PIN, HIGH);
      return;
    }

    resetIndicatorUntilMillis_ = 0;
    resetIndicatorOn_ = false;
    on_ = false;
    lastSyncActive_ = !syncActive;
    lastEncounterActive_ = !encounterActive;
    lastFrameMillis_ = 0;
    digitalWrite(NANO_H2_BLUE_LED_PIN, LOW);
  }

  if (flashUntilMillis_ != 0) {
    if (static_cast<int32_t>(flashUntilMillis_ - now) > 0) {
      show(flashColor_);
      digitalWrite(NANO_H2_BLUE_LED_PIN, LOW);
      return;
    }
    flashUntilMillis_ = 0;
    on_ = false;
    lastSyncActive_ = !syncActive;
    lastEncounterActive_ = !encounterActive;
    lastFrameMillis_ = 0;
  }

  if (!syncActive && !encounterActive) {
    if (on_ || lastSyncActive_ != syncActive ||
        lastEncounterActive_ != encounterActive || lastFrameMillis_ == 0) {
      lastSyncActive_ = syncActive;
      lastEncounterActive_ = encounterActive;
      on_ = false;
      lastFrameMillis_ = now;
      show(kOff);
      digitalWrite(NANO_H2_BLUE_LED_PIN, LOW);
    }
    return;
  }

  if (syncActive != lastSyncActive_ ||
      encounterActive != lastEncounterActive_) {
    lastSyncActive_ = syncActive;
    lastEncounterActive_ = encounterActive;
    on_ = true;
    lastFrameMillis_ = now;
    if (!syncActive) {
      encounterLevel_ = kEncounterMinLevel;
      encounterDirection_ = 1;
    }
    show(syncActive ? kSyncColor : scaleRgb(kEncounterColor, encounterLevel_));
    digitalWrite(NANO_H2_BLUE_LED_PIN, syncActive ? HIGH : LOW);
    return;
  }

  if (encounterActive) {
    if (now - lastFrameMillis_ < kFrameMs) return;
    lastFrameMillis_ = now;
    show(scaleRgb(kEncounterColor, encounterLevel_));
    stepPulse(encounterLevel_, encounterDirection_, kEncounterMinLevel,
              kEncounterMaxLevel);
    digitalWrite(NANO_H2_BLUE_LED_PIN, LOW);
    return;
  }

  const uint32_t blinkMs = fastSyncActive ? kFastSyncBlinkMs : kSyncBlinkMs;
  if (now - lastFrameMillis_ < blinkMs) return;

  lastFrameMillis_ = now;
  on_ = !on_;
  show(on_ ? kSyncColor : kOff);
  digitalWrite(NANO_H2_BLUE_LED_PIN, syncActive && on_ ? HIGH : LOW);
}

} // namespace bubblewalk
