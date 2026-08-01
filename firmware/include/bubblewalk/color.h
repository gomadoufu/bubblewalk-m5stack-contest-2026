#pragma once

#include <Arduino.h>

namespace bubblewalk {

struct RgbColor {
  uint8_t r;
  uint8_t g;
  uint8_t b;
};

RgbColor blendRgb(RgbColor left, RgbColor right, uint8_t value);
RgbColor triangleRgb(const RgbColor choices[3], float xByte, float yByte);
RgbColor scaleRgb(RgbColor color, uint8_t level);
RgbColor scaleRgbPercent(RgbColor color, uint8_t percent);
uint8_t byteFromFloat(float value);

} // namespace bubblewalk
