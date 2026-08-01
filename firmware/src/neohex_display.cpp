#include "bubblewalk/neohex_display.h"

#include <cstring>
#include <esp_random.h>

#ifndef NEOHEX_PIN
#define NEOHEX_PIN 2
#endif

#ifndef NEOHEX_COUNT
#define NEOHEX_COUNT 37
#endif

namespace bubblewalk {
namespace {

constexpr uint32_t kPaletteOrbitStepMs = 80;
constexpr uint8_t kEncounterRippleLevel = 92;

// A centered 3 x 5 canvas on the 4-5-6-7-6-5-4 NeoHEX rows.
constexpr uint8_t kDigitPixels[15] = {
    5, 6, 7,
    11, 12, 13,
    17, 18, 19,
    23, 24, 25,
    29, 30, 31,
};
constexpr const char *kDigitPatterns[7] = {
    "010110010010111", // 1
    "111001111100111", // 2
    "111001111001111", // 3
    "101101111001001", // 4
    "111100111001111", // 5
    "111100111101111", // 6
    "111001010010010", // 7
};

constexpr uint8_t kNearRingPixels[NeohexDisplay::kNearRingCount] = {
    11, 12, 17, 19, 24, 25,
};
constexpr uint8_t kMiddleRingPixels[NeohexDisplay::kMiddleRingCount] = {
    5, 6, 7, 10, 13, 16, 20, 23, 26, 29, 30, 31,
};
constexpr uint8_t kFarRingPixels[NeohexDisplay::kFarRingCount] = {
    0, 1, 2, 3, 4, 8, 9, 14, 15, 21, 22, 27, 28, 32, 33, 34, 35, 36,
};
constexpr uint8_t kNearOrbitPixels[NeohexDisplay::kNearRingCount] = {
    11, 12, 19, 25, 24, 17,
};
constexpr uint8_t kMiddleOrbitPixels[NeohexDisplay::kMiddleRingCount] = {
    5, 6, 7, 13, 20, 26, 31, 30, 29, 23, 16, 10,
};
constexpr uint8_t kFarOrbitPixels[NeohexDisplay::kFarRingCount] = {
    0, 1, 2, 3, 8, 14, 21, 27, 32, 36, 35, 34, 33, 28, 22, 15, 9, 4,
};

bool ringContains(const uint8_t *pixels, uint8_t count, uint8_t pixel) {
  for (uint8_t i = 0; i < count; i++) {
    if (pixels[i] == pixel) return true;
  }
  return false;
}

uint8_t animationEnvelope(uint32_t elapsed, uint32_t duration,
                          uint32_t fadeMillis) {
  if (elapsed >= duration || duration == 0) return 0;
  if (fadeMillis > 0 && elapsed < fadeMillis) {
    return static_cast<uint8_t>((elapsed * 255UL) / fadeMillis);
  }
  const uint32_t remaining = duration - elapsed;
  if (fadeMillis > 0 && remaining < fadeMillis) {
    return static_cast<uint8_t>((remaining * 255UL) / fadeMillis);
  }
  return 255;
}

uint8_t triangleWaveLevel(uint32_t elapsed, uint32_t periodMillis) {
  if (periodMillis < 2) return 255;
  const uint32_t halfPeriod = periodMillis / 2;
  const uint32_t phase = elapsed % periodMillis;
  if (phase < halfPeriod) {
    return static_cast<uint8_t>((phase * 255UL) / halfPeriod);
  }
  return static_cast<uint8_t>(((periodMillis - phase) * 255UL) /
                              (periodMillis - halfPeriod));
}

uint32_t syncBloomDelayForPixel(uint8_t pixel) {
  if (pixel == NeohexDisplay::kCenterPixel) return 0;
  if (ringContains(kNearRingPixels, NeohexDisplay::kNearRingCount, pixel)) return 100;
  if (ringContains(kMiddleRingPixels, NeohexDisplay::kMiddleRingCount, pixel)) return 220;
  return 340;
}

uint8_t syncBloomLevel(uint32_t elapsed, uint32_t delayMillis) {
  if (elapsed < delayMillis) return 0;
  const uint32_t localElapsed = elapsed - delayMillis;
  if (localElapsed < 180) {
    return static_cast<uint8_t>((localElapsed * 255UL) / 180UL);
  }
  if (elapsed < 850) return 255;
  if (elapsed >= NeohexDisplay::kSyncBloomDurationMs) return 0;
  return static_cast<uint8_t>(
      ((NeohexDisplay::kSyncBloomDurationMs - elapsed) * 255UL) /
      (NeohexDisplay::kSyncBloomDurationMs - 850UL));
}

} // namespace

static_assert(NEOHEX_COUNT == NeohexDisplay::kPixelCount,
              "NeoHEX display mapping requires 37 LEDs");
static_assert(sizeof(kDigitPixels) / sizeof(kDigitPixels[0]) == 15,
              "Device number glyphs require a 3 x 5 pixel canvas");

NeohexDisplay::NeohexDisplay()
    : pixels_(kPixelCount, NEOHEX_PIN, NEO_GRB + NEO_KHZ800) {}

void NeohexDisplay::begin() {
  pixels_.begin();
  clearPixels();
}

void NeohexDisplay::stepPulse(uint8_t &level, int8_t &direction,
                              uint8_t minLevel, uint8_t maxLevel) {
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

EncounterDistanceLevel NeohexDisplay::distanceLevelForRssi(int8_t rssi) {
  if (rssi >= kNearRssiDbm) return EncounterDistanceLevel::Near;
  if (rssi >= kMiddleRssiDbm) return EncounterDistanceLevel::Middle;
  return EncounterDistanceLevel::Far;
}

const char *NeohexDisplay::distanceName(EncounterDistanceLevel level) {
  switch (level) {
  case EncounterDistanceLevel::Near:
    return "near";
  case EncounterDistanceLevel::Middle:
    return "middle";
  case EncounterDistanceLevel::Far:
  default:
    return "far";
  }
}

const uint8_t *NeohexDisplay::ringPixels(EncounterDistanceLevel level) {
  switch (level) {
  case EncounterDistanceLevel::Near:
    return kNearRingPixels;
  case EncounterDistanceLevel::Middle:
    return kMiddleRingPixels;
  case EncounterDistanceLevel::Far:
  default:
    return kFarRingPixels;
  }
}

uint8_t NeohexDisplay::ringCount(EncounterDistanceLevel level) {
  switch (level) {
  case EncounterDistanceLevel::Near:
    return kNearRingCount;
  case EncounterDistanceLevel::Middle:
    return kMiddleRingCount;
  case EncounterDistanceLevel::Far:
  default:
    return kFarRingCount;
  }
}

uint8_t NeohexDisplay::brightnessPercentForPixel(uint8_t pixel) {
  if (pixel == kCenterPixel) return kCenterBrightnessPercent;
  if (ringContains(kNearRingPixels, kNearRingCount, pixel)) {
    return kNearRingBrightnessPercent;
  }
  if (ringContains(kMiddleRingPixels, kMiddleRingCount, pixel)) {
    return kMiddleRingBrightnessPercent;
  }
  return kFarRingBrightnessPercent;
}

void NeohexDisplay::expireSlots(uint32_t now, uint16_t retentionMinutes) {
  if (retentionMinutes == 0) return;
  const uint32_t retentionMillis =
      static_cast<uint32_t>(retentionMinutes) * 60UL * 1000UL;
  uint8_t expiredCount = 0;
  for (uint8_t pixel = 0; pixel < kPixelCount; pixel++) {
    Slot &slot = slots_[pixel];
    if (!slot.valid || now - slot.seenAtMillis < retentionMillis) continue;
    memset(&slot, 0, sizeof(slot));
    if (storedCount_ > 0) storedCount_--;
    expiredCount++;
  }
  if (expiredCount > 0) {
    Serial.printf("encounter_ring_expired expired=%u stored=%u retention_minutes=%u\n",
                  expiredCount, storedCount_, retentionMinutes);
  }
}

int8_t NeohexDisplay::findSlotForNode(uint8_t nodeId) const {
  for (uint8_t pixel = 0; pixel < kPixelCount; pixel++) {
    if (slots_[pixel].valid && slots_[pixel].nodeId == nodeId) {
      return static_cast<int8_t>(pixel);
    }
  }
  return -1;
}

void NeohexDisplay::clearSlot(uint8_t pixel) {
  if (pixel >= kPixelCount || !slots_[pixel].valid) return;
  memset(&slots_[pixel], 0, sizeof(slots_[pixel]));
  if (storedCount_ > 0) storedCount_--;
}

uint8_t NeohexDisplay::pickPixel(EncounterDistanceLevel level,
                                 bool *usedEmptyPixel) const {
  const uint8_t *pixels = ringPixels(level);
  const uint8_t count = ringCount(level);
  uint8_t emptyPixels[kFarRingCount] = {};
  uint8_t emptyCount = 0;
  for (uint8_t i = 0; i < count; i++) {
    const uint8_t pixel = pixels[i];
    if (pixel != kCenterPixel && !slots_[pixel].valid) {
      emptyPixels[emptyCount++] = pixel;
    }
  }
  if (emptyCount > 0) {
    *usedEmptyPixel = true;
    return emptyPixels[esp_random() % emptyCount];
  }
  *usedEmptyPixel = false;
  return pixels[esp_random() % count];
}

EncounterDisplayUpdate NeohexDisplay::placeEncounter(
    RgbColor color, uint8_t nodeId, uint16_t sequence,
    EncounterDistanceLevel level, uint32_t seenAtMillis, bool animate,
    bool slotMissing, bool levelChanged, uint32_t now) {
  bool usedEmptyPixel = false;
  const uint8_t pixel = pickPixel(level, &usedEmptyPixel);
  slots_[pixel] = {color, nodeId, sequence, seenAtMillis, level, true};
  if (usedEmptyPixel && storedCount_ < kPixelCount - 1) {
    storedCount_++;
  } else {
    overflow_ = true;
  }
  if (animate) startEncounterPop(color, pixel, level, now);
  return {slotMissing,
          levelChanged,
          true,
          usedEmptyPixel,
          pixel,
          brightnessPercentForPixel(pixel),
          storedCount_,
          overflow_,
          level};
}

EncounterDisplayUpdate NeohexDisplay::observeEncounter(
    RgbColor color, uint8_t nodeId, uint16_t sequence, int8_t rssi,
    uint32_t seenAtMillis, uint16_t retentionMinutes, bool forcePlacement,
    bool animate) {
  expireSlots(seenAtMillis, retentionMinutes);
  const int8_t existingPixel = findSlotForNode(nodeId);
  const EncounterDistanceLevel level = distanceLevelForRssi(rssi);
  const bool slotMissing = existingPixel < 0;
  const bool levelChanged = existingPixel >= 0 &&
                            slots_[existingPixel].level != level;
  if (!forcePlacement && !slotMissing && !levelChanged) {
    return {false, false, false, false, static_cast<uint8_t>(existingPixel),
            brightnessPercentForPixel(static_cast<uint8_t>(existingPixel)),
            storedCount_, overflow_, level};
  }
  if (existingPixel >= 0) clearSlot(static_cast<uint8_t>(existingPixel));
  const bool animatePlacement = animate && (forcePlacement || slotMissing);
  return placeEncounter(color, nodeId, sequence, level, seenAtMillis,
                        animatePlacement, slotMissing, levelChanged,
                        seenAtMillis);
}

EncounterDisplayUpdate NeohexDisplay::restoreEncounter(
    RgbColor color, uint8_t nodeId, uint16_t sequence, int8_t rssi,
    uint32_t seenAtMillis) {
  return placeEncounter(color, nodeId, sequence, distanceLevelForRssi(rssi),
                        seenAtMillis, false, true, false, seenAtMillis);
}

void NeohexDisplay::clearEncounters() {
  memset(slots_, 0, sizeof(slots_));
  storedCount_ = 0;
  overflow_ = false;
  memset(&animation_, 0, sizeof(animation_));
}

void NeohexDisplay::startSyncBloom(RgbColor color, uint32_t now) {
  memset(&animation_, 0, sizeof(animation_));
  animation_.kind = AnimationKind::SyncBloom;
  animation_.startedAtMillis = now;
  animation_.durationMillis = kSyncBloomDurationMs;
  animation_.color = color;
  Serial.printf("neohex_animation=sync_bloom duration_ms=%lu rgb=%u,%u,%u\n",
                static_cast<unsigned long>(animation_.durationMillis), color.r,
                color.g, color.b);
}

void NeohexDisplay::startEncounterPop(RgbColor color, uint8_t pixel,
                                      EncounterDistanceLevel level,
                                      uint32_t now) {
  memset(&animation_, 0, sizeof(animation_));
  animation_.kind = AnimationKind::EncounterPop;
  animation_.startedAtMillis = now;
  animation_.durationMillis = kEncounterPopDurationMs;
  animation_.color = color;
  animation_.targetPixel = pixel;
  animation_.targetLevel = level;
  Serial.printf("neohex_animation=encounter_pop duration_ms=%lu pixel=%u level=%s rgb=%u,%u,%u\n",
                static_cast<unsigned long>(animation_.durationMillis), pixel,
                distanceName(level), color.r, color.g, color.b);
}

bool NeohexDisplay::paletteContains(const AnimationState &state,
                                    RgbColor color) {
  for (uint8_t i = 0; i < state.paletteCount; i++) {
    const RgbColor existing = state.palette[i];
    if (existing.r == color.r && existing.g == color.g && existing.b == color.b) {
      return true;
    }
  }
  return false;
}

void NeohexDisplay::startPaletteOrbit(uint32_t now) {
  AnimationState next = {};
  for (uint8_t pixel = 0; pixel < kPixelCount; pixel++) {
    if (pixel == kCenterPixel || !slots_[pixel].valid) continue;
    const RgbColor color = slots_[pixel].color;
    if (!paletteContains(next, color) && next.paletteCount < kPixelCount - 1) {
      next.palette[next.paletteCount++] = color;
    }
  }
  if (next.paletteCount == 0) {
    memset(&animation_, 0, sizeof(animation_));
    return;
  }
  next.kind = AnimationKind::PaletteOrbit;
  next.startedAtMillis = now;
  next.durationMillis = kPaletteOrbitDurationMs;
  animation_ = next;
  Serial.printf("neohex_animation=palette_orbit duration_ms=%lu colors=%u\n",
                static_cast<unsigned long>(animation_.durationMillis),
                animation_.paletteCount);
}

void NeohexDisplay::setAnimationPixel(uint8_t pixel, RgbColor color,
                                      uint8_t level) {
  if (pixel >= kPixelCount) return;
  const RgbColor scaled = scaleRgb(color, level);
  pixels_.setPixelColor(pixel, pixels_.Color(scaled.r, scaled.g, scaled.b));
}

void NeohexDisplay::renderPaletteRing(const uint8_t *pixels, uint8_t count,
                                      uint8_t phase, uint8_t level) {
  const uint8_t dotCount = animation_.paletteCount < count
                               ? animation_.paletteCount
                               : count;
  if (dotCount == 0) return;
  for (uint8_t i = 0; i < dotCount; i++) {
    const uint8_t spaced = static_cast<uint8_t>(
        (static_cast<uint16_t>(i) * count) / dotCount);
    const uint8_t pixelIndex = static_cast<uint8_t>((phase + spaced) % count);
    setAnimationPixel(pixels[pixelIndex],
                      animation_.palette[i % animation_.paletteCount], level);
  }
}

void NeohexDisplay::renderAnimationOverlay(uint32_t now) {
  if (animation_.kind == AnimationKind::None) return;
  const uint32_t elapsed = now - animation_.startedAtMillis;
  if (elapsed >= animation_.durationMillis) {
    memset(&animation_, 0, sizeof(animation_));
    return;
  }

  if (animation_.kind == AnimationKind::SyncBloom) {
    for (uint8_t pixel = 0; pixel < kPixelCount; pixel++) {
      const uint8_t level = syncBloomLevel(elapsed, syncBloomDelayForPixel(pixel));
      if (level > 0) setAnimationPixel(pixel, animation_.color, level);
    }
    return;
  }

  if (animation_.kind == AnimationKind::EncounterPop) {
    const uint8_t envelope = animationEnvelope(elapsed, animation_.durationMillis, 110);
    const uint8_t pulse = triangleWaveLevel(elapsed, 280);
    const uint8_t targetLevel = static_cast<uint8_t>(
        (static_cast<uint16_t>(80 + (static_cast<uint16_t>(pulse) * 175U) / 255U) *
         envelope) /
        255U);
    const uint8_t ringLevel = static_cast<uint8_t>(
        (static_cast<uint16_t>(kEncounterRippleLevel) *
         animationEnvelope(elapsed, 470, 120)) /
        255U);
    if (ringLevel > 0) {
      const uint8_t *ring = ringPixels(animation_.targetLevel);
      for (uint8_t i = 0; i < ringCount(animation_.targetLevel); i++) {
        setAnimationPixel(ring[i], animation_.color, ringLevel);
      }
    }
    setAnimationPixel(animation_.targetPixel, animation_.color, targetLevel);
    return;
  }

  for (uint8_t pixel = 0; pixel < kPixelCount; pixel++) {
    if (pixel != kCenterPixel) pixels_.setPixelColor(pixel, 0);
  }
  const uint8_t level = static_cast<uint8_t>(
      (static_cast<uint16_t>(220) *
       animationEnvelope(elapsed, animation_.durationMillis, 220)) /
      255U);
  const uint8_t farPhase =
      static_cast<uint8_t>((elapsed / kPaletteOrbitStepMs) % kFarRingCount);
  const uint8_t middlePhase = static_cast<uint8_t>(
      kMiddleRingCount - 1 -
      ((elapsed / (kPaletteOrbitStepMs + 25)) % kMiddleRingCount));
  const uint8_t nearPhase = static_cast<uint8_t>(
      (elapsed / (kPaletteOrbitStepMs + 50)) % kNearRingCount);
  renderPaletteRing(kFarOrbitPixels, kFarRingCount, farPhase, level);
  renderPaletteRing(kMiddleOrbitPixels, kMiddleRingCount, middlePhase, level);
  renderPaletteRing(kNearOrbitPixels, kNearRingCount, nearPhase, level);
}

void NeohexDisplay::render(RgbColor ownerColor, uint8_t brightness,
                           uint16_t retentionMinutes, uint32_t now) {
  expireSlots(now, retentionMinutes);
  pixels_.setBrightness(brightness);
  pixels_.clear();
  const RgbColor center = scaleRgb(
      scaleRgbPercent(ownerColor, kCenterBrightnessPercent), centerPulseLevel_);
  pixels_.setPixelColor(kCenterPixel, pixels_.Color(center.r, center.g, center.b));
  for (uint8_t pixel = 0; pixel < kPixelCount; pixel++) {
    if (pixel == kCenterPixel || !slots_[pixel].valid) continue;
    const RgbColor color =
        scaleRgbPercent(slots_[pixel].color, brightnessPercentForPixel(pixel));
    pixels_.setPixelColor(pixel, pixels_.Color(color.r, color.g, color.b));
  }
  renderAnimationOverlay(now);
  pixels_.show();
}

void NeohexDisplay::update(RgbColor ownerColor, uint8_t brightness,
                           uint16_t retentionMinutes, uint32_t now) {
  if (lastFrameMillis_ != 0 && now - lastFrameMillis_ < kFrameMs) return;
  lastFrameMillis_ = now;
  for (uint8_t i = 0; i < kCenterPulseStepPerFrame; i++) {
    stepPulse(centerPulseLevel_, centerPulseDirection_, kCenterPulseMinLevel,
              kCenterPulseMaxLevel);
  }
  render(ownerColor, brightness, retentionMinutes, now);
}

void NeohexDisplay::showPixelTestStep(RgbColor color, uint8_t brightness) {
  pixels_.clear();
  pixels_.setBrightness(brightness);
  pixels_.setPixelColor(testPixelIndex_, pixels_.Color(color.r, color.g, color.b));
  pixels_.show();
  testPixelIndex_ = static_cast<uint8_t>((testPixelIndex_ + 1) % kPixelCount);
}

void NeohexDisplay::showDeviceNumber(uint8_t number, RgbColor color,
                                     uint8_t brightness) {
  if (number < 1 || number > 7) return;
  pixels_.clear();
  pixels_.setBrightness(brightness);
  const char *pattern = kDigitPatterns[number - 1];
  for (uint8_t i = 0; i < 15; i++) {
    if (pattern[i] != '1') continue;
    pixels_.setPixelColor(kDigitPixels[i], pixels_.Color(color.r, color.g, color.b));
  }
  pixels_.show();
}

void NeohexDisplay::clearPixels() {
  pixels_.clear();
  pixels_.show();
}

} // namespace bubblewalk
