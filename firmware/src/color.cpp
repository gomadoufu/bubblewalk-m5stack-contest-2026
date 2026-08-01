#include "bubblewalk/color.h"

#include <cmath>

namespace bubblewalk {
namespace {

float clampByteFloat(float value) {
  if (value < 0.0f) return 0.0f;
  if (value > 255.0f) return 255.0f;
  return value;
}

void normalizeTriangleWeights(float weights[3]) {
  for (uint8_t i = 0; i < 3; i++) {
    if (weights[i] < 0.0f) weights[i] = 0.0f;
  }
  const float total = weights[0] + weights[1] + weights[2];
  if (total <= 0.0f) {
    weights[0] = 0.0f;
    weights[1] = 1.0f;
    weights[2] = 0.0f;
    return;
  }
  for (uint8_t i = 0; i < 3; i++) weights[i] /= total;
}

void triangleWeightsForCoordinates(float xByte, float yByte, float weights[3]) {
  const float x = clampByteFloat(xByte) / 255.0f;
  const float y = clampByteFloat(yByte) / 255.0f;
  constexpr float ax = 0.12f;
  constexpr float ay = 0.88f;
  constexpr float bx = 0.50f;
  constexpr float by = 0.08f;
  constexpr float cx = 0.88f;
  constexpr float cy = 0.88f;
  constexpr float denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);

  weights[0] = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
  weights[1] = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
  weights[2] = 1.0f - weights[0] - weights[1];
  normalizeTriangleWeights(weights);
}

uint8_t weightedChannel(uint8_t channel0, uint8_t channel1, uint8_t channel2,
                        const float weights[3]) {
  const float value = static_cast<float>(channel0) * weights[0] +
                      static_cast<float>(channel1) * weights[1] +
                      static_cast<float>(channel2) * weights[2];
  return byteFromFloat(value);
}

} // namespace

uint8_t byteFromFloat(float value) {
  return static_cast<uint8_t>(lroundf(clampByteFloat(value)));
}

RgbColor blendRgb(RgbColor left, RgbColor right, uint8_t value) {
  const uint16_t inverse = 255 - value;
  return {
      static_cast<uint8_t>((left.r * inverse + right.r * value) / 255),
      static_cast<uint8_t>((left.g * inverse + right.g * value) / 255),
      static_cast<uint8_t>((left.b * inverse + right.b * value) / 255),
  };
}

RgbColor triangleRgb(const RgbColor choices[3], float xByte, float yByte) {
  float weights[3] = {};
  triangleWeightsForCoordinates(xByte, yByte, weights);
  return {
      weightedChannel(choices[0].r, choices[1].r, choices[2].r, weights),
      weightedChannel(choices[0].g, choices[1].g, choices[2].g, weights),
      weightedChannel(choices[0].b, choices[1].b, choices[2].b, weights),
  };
}

RgbColor scaleRgb(RgbColor color, uint8_t level) {
  return {
      static_cast<uint8_t>((static_cast<uint16_t>(color.r) * level) / 255),
      static_cast<uint8_t>((static_cast<uint16_t>(color.g) * level) / 255),
      static_cast<uint8_t>((static_cast<uint16_t>(color.b) * level) / 255),
  };
}

RgbColor scaleRgbPercent(RgbColor color, uint8_t percent) {
  return {
      static_cast<uint8_t>((static_cast<uint16_t>(color.r) * percent) / 100),
      static_cast<uint8_t>((static_cast<uint16_t>(color.g) * percent) / 100),
      static_cast<uint8_t>((static_cast<uint16_t>(color.b) * percent) / 100),
  };
}

} // namespace bubblewalk
