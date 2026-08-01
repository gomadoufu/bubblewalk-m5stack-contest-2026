#pragma once

#include <Arduino.h>

namespace bubblewalk {

uint16_t readLe16(const uint8_t *data);
uint32_t readLe32(const uint8_t *data);
void writeLe16(uint8_t *data, uint16_t value);
void writeLe32(uint8_t *data, uint32_t value);
uint16_t crc16CcittFalse(const uint8_t *data, uint16_t length);

} // namespace bubblewalk
