// ??$$$ newer code
import mongoose from "mongoose";
import "dotenv/config";
import process from "process";
import { connectDB } from "../lib/db";
import Part from "../models/part.model";

const CURATED_PARTS = [
  // === MCUs ===
  {
    mpn: "ESP32-DEVKIT-C",
    name: "ESP32 DevKit V1",
    manufacturer: "Espressif Systems",
    description: "ESP32 Wi-Fi + Bluetooth dual-core development board, compatible with NodeMCU-32S and Arduino IDE.",
    imageUrl: "https://robu.in/wp-content/uploads/2018/11/NodeMCU-32S-ESP32-WiFi-Bluetooth-Development-Board-1.jpg",
    datasheetUrl: "https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32d_esp32-wroom-32u_datasheet_en.pdf",
    available: 1500,
    price: 450,
    category: "MCUs",
    wokwiPartType: "wokwi-esp32-devkit-v1",
    specs: { "Core": "Xtensa Dual-Core 32-bit LX6", "WiFi": "802.11 b/g/n", "Bluetooth": "v4.2 BR/EDR and BLE", "SRAM": "520 KB", "Flash": "4 MB" }
  },
  {
    mpn: "ESP8266-NODEMCU",
    name: "NodeMCU ESP8266",
    manufacturer: "Ai-Thinker",
    description: "ESP8266 serial WiFi development board, based on ESP-12E module, programmed with Lua or Arduino IDE.",
    imageUrl: "https://robu.in/wp-content/uploads/2016/04/nodemcu_esp8266.jpg",
    datasheetUrl: "https://www.espressif.com/sites/default/files/documentation/0a-esp8266ex_datasheet_en.pdf",
    available: 2000,
    price: 250,
    category: "MCUs",
    wokwiPartType: "wokwi-nodemcu-esp8266",
    specs: { "Core": "Tensilica L106 32-bit", "WiFi": "802.11 b/g/n", "SRAM": "80 KB", "Flash": "4 MB" }
  },
  {
    mpn: "ARDUINO-NANO-R3",
    name: "Arduino Nano",
    manufacturer: "Arduino",
    description: "Small, complete, and breadboard-friendly board based on the ATmega328P, operating with a Mini-B USB cable.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/arduino-nano-v3.0.jpg",
    datasheetUrl: "https://docs.arduino.cc/resources/datasheets/A000005-datasheet.pdf",
    available: 3000,
    price: 300,
    category: "MCUs",
    wokwiPartType: "wokwi-arduino-nano",
    specs: { "Microcontroller": "ATmega328P", "Operating Voltage": "5V", "Digital I/O Pins": "14", "Analog Input Pins": "8", "Flash Memory": "32 KB" }
  },
  {
    mpn: "RASPBERRY-PI-PICO",
    name: "Raspberry Pi Pico",
    manufacturer: "Raspberry Pi Foundation",
    description: "Low-cost, high-performance microcontroller board built around the RP2040 chip designed by Raspberry Pi.",
    imageUrl: "https://robu.in/wp-content/uploads/2021/01/raspberry-pi-pico.jpg",
    datasheetUrl: "https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf",
    available: 2500,
    price: 350,
    category: "MCUs",
    wokwiPartType: "wokwi-pi-pico",
    specs: { "Chip": "RP2040", "Core": "Dual-core ARM Cortex M0+", "SRAM": "264 KB", "Flash": "2 MB QSPI", "GPIO Pins": "26" }
  },
  {
    mpn: "STM32F103C8T6",
    name: "STM32F103 Blue Pill",
    manufacturer: "STMicroelectronics",
    description: "STM32 Blue Pill development board with ARM Cortex-M3 32-bit MCU, 72 MHz, 64 KB Flash, 20 KB SRAM.",
    imageUrl: "https://robu.in/wp-content/uploads/2016/09/stm32f103c8t6-minimum-system-board.jpg",
    datasheetUrl: "https://www.st.com/resource/en/datasheet/stm32f103c8.pdf",
    available: 1200,
    price: 320,
    category: "MCUs",
    wokwiPartType: "wokwi-stm32-bluepill",
    specs: { "Core": "ARM 32-bit Cortex-M3", "Frequency": "72 MHz", "Flash": "64 KB", "SRAM": "20 KB" }
  },

  // === Sensors ===
  {
    mpn: "DHT22-AM2302",
    name: "DHT22 Temperature & Humidity Sensor",
    manufacturer: "Aosong Electronics",
    description: "High accuracy digital temperature and humidity sensor module with single-bus interface.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/dht22-temperature-humidity-sensor.jpg",
    datasheetUrl: "https://www.sparkfun.com/datasheets/Sensors/Temperature/DHT22.pdf",
    available: 1800,
    price: 250,
    category: "Sensors",
    wokwiPartType: "wokwi-dht22",
    specs: { "Temp Range": "-40 to 80 °C", "Temp Accuracy": "±0.5 °C", "Humidity Range": "0-100% RH", "Humidity Accuracy": "±2% RH" }
  },
  {
    mpn: "MPU-6050",
    name: "MPU6050 6-Axis Gyro & Accelerometer",
    manufacturer: "TDK InvenSense",
    description: "6-axis motion tracking device combining a 3-axis gyroscope, 3-axis accelerometer, and Digital Motion Processor.",
    imageUrl: "https://robu.in/wp-content/uploads/2015/09/mpu6050-gyro-sensor-module.jpg",
    datasheetUrl: "https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Datasheet1.pdf",
    available: 1500,
    price: 150,
    category: "Sensors",
    wokwiPartType: "wokwi-mpu6050",
    specs: { "Gyro Range": "±250 500 1000 2000 °/s", "Accel Range": "±2 ±4 ±8 ±16 g", "Interface": "I2C" }
  },
  {
    mpn: "HC-SR04",
    name: "HC-SR04 Ultrasonic Distance Sensor",
    manufacturer: "Generic",
    description: "Ultrasonic rangefinder sensor module providing 2cm to 400cm non-contact measurement functionality.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/hc-sr04-ultrasonic-sensor.jpg",
    datasheetUrl: "https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf",
    available: 4000,
    price: 75,
    category: "Sensors",
    wokwiPartType: "wokwi-hc-sr04",
    specs: { "Supply Voltage": "5V DC", "Ranging Distance": "2 cm - 400 cm", "Measuring Angle": "15 degrees" }
  },
  {
    mpn: "BMP280",
    name: "BMP280 Barometric Pressure & Temp Sensor",
    manufacturer: "Bosch Sensortec",
    description: "Absolute barometric pressure and temperature sensor module, perfect for altitude tracking and weather stations.",
    imageUrl: "https://robu.in/wp-content/uploads/2016/09/bmp280-pressure-sensor-module.jpg",
    datasheetUrl: "https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmp280-ds001.pdf",
    available: 900,
    price: 110,
    category: "Sensors",
    wokwiPartType: "wokwi-bmp280",
    specs: { "Pressure Range": "300 to 1100 hPa", "Interface": "I2C or SPI", "Supply Voltage": "1.8V - 3.6V" }
  },
  {
    mpn: "HC-SR501",
    name: "PIR HC-SR501 Motion Sensor",
    manufacturer: "Generic",
    description: "Passive infrared pyroelectric motion sensor module for security and automation systems.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/hc-sr501-pir-sensor.jpg",
    datasheetUrl: "https://www.mpja.com/download/31227sc.pdf",
    available: 2200,
    price: 85,
    category: "Sensors",
    wokwiPartType: "wokwi-pir-motion-sensor",
    specs: { "Delay Time": "0.3s - 18s", "Detection Range": "3 - 7 meters", "Angle": "<110 degrees" }
  },
  {
    mpn: "LDR-5MM-GL5516",
    name: "LDR 5mm Photoresistor",
    manufacturer: "Generic",
    description: "Light dependent resistor for detecting light levels. Resistance drops as ambient light intensity increases.",
    imageUrl: "https://robu.in/wp-content/uploads/2015/09/5mm-ldr.jpg",
    datasheetUrl: "https://cdn.sparkfun.com/datasheets/Sensors/LightImaging/SEN-09088.pdf",
    available: 10000,
    price: 5,
    category: "Sensors",
    wokwiPartType: "wokwi-photoresistor",
    specs: { "Peak Spectral": "540 nm", "Max Voltage": "150 VDC", "Light Resistance (10 Lux)": "5-10 KΩ" }
  },

  // === Motors ===
  {
    mpn: "SG90-SERVO",
    name: "SG90 Micro Servo Motor",
    manufacturer: "TowerPro",
    description: "Tiny and lightweight 180-degree analog micro servo motor, ideal for RC models and robotics arms.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/sg90_servo.jpg",
    datasheetUrl: "http://www.ee.ic.ac.uk/pjs/learning/servo/SG90%20Datasheet.pdf",
    available: 3500,
    price: 110,
    category: "Motors",
    wokwiPartType: "wokwi-servo",
    specs: { "Rotation Angle": "180 degrees", "Operating Speed": "0.1 s/60 degree at 4.8V", "Stall Torque": "1.8 kg-cm" }
  },
  {
    mpn: "28BYJ-48-STEPPER",
    name: "28BYJ-48 Stepper Motor + ULN2003",
    manufacturer: "Generic",
    description: "5V geared 4-phase unipolar stepper motor. Includes ULN2003 driver board for easy microchip wiring.",
    imageUrl: "https://robu.in/wp-content/uploads/2015/09/28byj-48-stepper-motor-uln2003-driver.jpg",
    datasheetUrl: "https://www.instructables.com/member/mikey77/files/",
    available: 1400,
    price: 180,
    category: "Motors",
    wokwiPartType: "wokwi-stepper-motor",
    specs: { "Voltage": "5V DC", "Phase": "4", "Step Angle": "5.625° / 64", "Gear Ratio": "1:64" }
  },
  {
    mpn: "TOY-DC-MOTOR-130",
    name: "Standard 130 Toy DC Motor",
    manufacturer: "Generic",
    description: "Small 130-size hobby DC motor, operates on 3V to 6V, perfect for fans, DIY projects and toy cars.",
    imageUrl: "https://robu.in/wp-content/uploads/2015/09/130-toy-dc-motor.jpg",
    datasheetUrl: "https://www.adafruit.com/product/711",
    available: 5000,
    price: 25,
    category: "Motors",
    wokwiPartType: "wokwi-dc-motor",
    specs: { "Voltage Range": "3V - 6V DC", "No-load Speed": "9000 RPM at 3V", "Shaft Diameter": "2 mm" }
  },
  {
    mpn: "BRUSHLESS-2205-2300KV",
    name: "RS2205 2300KV Brushless Motor",
    manufacturer: "Emax",
    description: "High-performance brushless motor for racing quadcopters, supports 3S-4S LiPo batteries.",
    imageUrl: "https://robu.in/wp-content/uploads/2016/09/emax-rs2205-2300kv-brushless-motor.jpg",
    datasheetUrl: "https://www.emaxmodel.com/rs2205-racespec.html",
    available: 800,
    price: 650,
    category: "Motors",
    wokwiPartType: "wokwi-brushless-motor",
    specs: { "KV Rating": "2300 KV", "Max Thrust": "1024 g", "LiPo Cells": "3S - 4S", "Weight": "30 g" }
  },

  // === ESCs ===
  {
    mpn: "HAKRC-4IN1-45A-ESC",
    name: "HAKRC 4-in-1 45A ESC",
    manufacturer: "HAKRC",
    description: "HAKRC 45A BLHeli_S 2-6S 4-in-1 electronic speed controller for FPV racing drones.",
    imageUrl: "https://robu.in/wp-content/uploads/2020/11/hakrc-45a-4in1-esc.jpg",
    datasheetUrl: "http://www.hakrc.com/en/product/detail/45A.html",
    available: 500,
    price: 1800,
    category: "ESCs",
    wokwiPartType: "wokwi-esc-4in1",
    specs: { "Continuous Current": "45A", "Burst Current": "50A", "Firmware": "BLHeli_S", "Input Voltage": "2S-6S LiPo" }
  },
  {
    mpn: "GENERIC-ESC-30A",
    name: "Generic 30A ESC",
    manufacturer: "Generic",
    description: "Standard 30A brushless motor speed controller (ESC) with 5V 2A BEC for RC airplanes and quadcopters.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/30a-esc.jpg",
    datasheetUrl: "https://www.hobbywing.com/products/pdf/FlyFun.pdf",
    available: 1200,
    price: 380,
    category: "ESCs",
    wokwiPartType: "wokwi-esc-30a",
    specs: { "Continuous Current": "30A", "BEC Output": "5V / 2A", "LiPo Cells": "2S - 3S" }
  },

  // === Displays ===
  {
    mpn: "SSD1306-OLED-0.96",
    name: "SSD1306 OLED Display 128x64",
    manufacturer: "Generic",
    description: "0.96 inch monochrome OLED display module, 128x64 resolution, communicating via I2C interface.",
    imageUrl: "https://robu.in/wp-content/uploads/2015/09/0.96-inch-oled-module.jpg",
    datasheetUrl: "https://cdn-shop.adafruit.com/datasheets/SSD1306.pdf",
    available: 3000,
    price: 280,
    category: "Displays",
    wokwiPartType: "wokwi-ssd1306",
    specs: { "Screen Size": "0.96 Inch", "Resolution": "128 x 64 pixels", "Driver IC": "SSD1306", "Interface": "I2C" }
  },
  {
    mpn: "LCD-16X2-I2C",
    name: "LCD 16x2 Display with I2C Module",
    manufacturer: "Generic",
    description: "16 characters by 2 lines alphanumeric LCD display. Pre-soldered I2C backpack reduces pins to 4.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/16x2-lcd-i2c.jpg",
    datasheetUrl: "https://docs.arduino.cc/resources/datasheets/LCD1602.pdf",
    available: 2500,
    price: 190,
    category: "Displays",
    wokwiPartType: "wokwi-lcd1602",
    specs: { "Display Format": "16 Characters x 2 Lines", "Backlight": "Blue/Green", "Interface": "I2C (SDA/SCL)" }
  },
  {
    mpn: "TFT-ILI9341-2.8",
    name: "TFT LCD Display ILI9341 2.8 Inch",
    manufacturer: "Generic",
    description: "2.8 inch color TFT SPI LCD touch screen display module, resolution 240x320 with built-in SD slot.",
    imageUrl: "https://robu.in/wp-content/uploads/2016/09/2.8-inch-tft-spi.jpg",
    datasheetUrl: "http://www.lcdwiki.com/res/ILI9341/ILI9341_Datasheet.pdf",
    available: 600,
    price: 750,
    category: "Displays",
    wokwiPartType: "wokwi-ili9341",
    specs: { "Screen Size": "2.8 Inch", "Resolution": "240 x 320 Pixels", "Driver IC": "ILI9341", "Interface": "SPI" }
  },

  // === Power ===
  {
    mpn: "TP4056-LIPO-CHARGER",
    name: "TP4056 Micro USB LiPo Charger Module",
    manufacturer: "Generic",
    description: "1A lithium battery charging and protection board module, micro USB connector for 3.7V batteries.",
    imageUrl: "https://robu.in/wp-content/uploads/2015/09/tp4056-charger-module.jpg",
    datasheetUrl: "https://dlnmh9ip6v2uc.cloudfront.net/datasheets/Prototyping/TP4056.pdf",
    available: 5000,
    price: 35,
    category: "Power",
    wokwiPartType: "wokwi-tp4056-charger",
    specs: { "Charge Current": "1A (adjustable)", "Input Voltage": "4.5V - 5.5V", "Full Charge Voltage": "4.2V" }
  },
  {
    mpn: "LM7805-TO220",
    name: "LM7805 5V Voltage Regulator",
    manufacturer: "STMicroelectronics",
    description: "Linear voltage regulator, fixed 5V output, TO-220 package, up to 1.5A output current.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/lm7805.jpg",
    datasheetUrl: "https://www.st.com/resource/en/datasheet/l78.pdf",
    available: 8000,
    price: 15,
    category: "Power",
    wokwiPartType: "wokwi-lm7805",
    specs: { "Output Voltage": "5V DC", "Input Voltage Max": "35V DC", "Output Current": "Up to 1.5A" }
  },
  {
    mpn: "MT3608-BOOST-CONVERTER",
    name: "MT3608 DC-DC Step-Up Boost Converter Module",
    manufacturer: "Generic",
    description: "Mini step-up boost converter module, input 2V-24V to output 5V-28V, max output 2A.",
    imageUrl: "https://robu.in/wp-content/uploads/2015/09/mt3608-boost-converter.jpg",
    datasheetUrl: "https://www.olimex.com/Products/Breadboarding/BB-PWR-3608/resources/MT3608.pdf",
    available: 2400,
    price: 45,
    category: "Power",
    wokwiPartType: "wokwi-mt3608",
    specs: { "Max Output Current": "2A", "Input Voltage": "2V - 24V", "Output Voltage": "5V - 28V" }
  },
  {
    mpn: "LIPO-3.7V-1000MAH",
    name: "LiPo Battery 3.7V 1000mAh",
    manufacturer: "Generic",
    description: "Rechargeable Lithium Polymer battery cell, 3.7V nominal, 1000mAh capacity, with JST-PH connector.",
    imageUrl: "https://robu.in/wp-content/uploads/2015/09/lipo-1000mah-3.7v.jpg",
    datasheetUrl: "https://cdn.sparkfun.com/datasheets/Batteries/LiPo/PRT-13813-Datasheet.pdf",
    available: 1500,
    price: 320,
    category: "Power",
    wokwiPartType: "wokwi-battery-lipo",
    specs: { "Nominal Voltage": "3.7V", "Capacity": "1000 mAh", "Discharge Rate": "25C" }
  },

  // === Comms ===
  {
    mpn: "HC-05-BLUETOOTH",
    name: "HC-05 Bluetooth Module",
    manufacturer: "Generic",
    description: "Serial Bluetooth RF transceiver module, allows microcontrollers to communicate via SPP.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/hc-05-bluetooth.jpg",
    datasheetUrl: "https://components101.com/sites/default/files/component-datasheet/HC-05-Bluetooth-Module-Datasheet.pdf",
    available: 3000,
    price: 250,
    category: "Comms",
    wokwiPartType: "wokwi-hc05",
    specs: { "Protocol": "Bluetooth v2.0+EDR", "Frequency": "2.4 GHz ISM band", "Interface": "UART Serial" }
  },
  {
    mpn: "NRF24L01-MODULE",
    name: "NRF24L01+ 2.4GHz Wireless Module",
    manufacturer: "Nordic Semiconductor",
    description: "Ultra-low power 2.4GHz RF transceiver module for point-to-point wireless projects.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/nrf24l01.jpg",
    datasheetUrl: "https://www.sparkfun.com/datasheets/Components/nRF24L01_prelim_prod_spec_1_2.pdf",
    available: 4000,
    price: 80,
    category: "Comms",
    wokwiPartType: "wokwi-nrf24l01",
    specs: { "Frequency Band": "2.4 GHz ISM", "Data Rate": "Up to 2 Mbps", "Interface": "SPI" }
  },
  {
    mpn: "SX1276-LORA-868",
    name: "LoRa SX1276 Wireless Module 868MHz",
    manufacturer: "Semtech",
    description: "Long-range LoRa spread spectrum transceiver module operating at 868 MHz for IoT telemetry.",
    imageUrl: "https://robu.in/wp-content/uploads/2018/11/LoRa-SX1276-868MHz.jpg",
    datasheetUrl: "https://www.semtech.com/uploads/documents/DS_SX1276_7_8_9_W_APP_V7.pdf",
    available: 700,
    price: 350,
    category: "Comms",
    wokwiPartType: "wokwi-lora-sx1276",
    specs: { "Frequency Range": "868 MHz", "Modulation": "LoRa / FSK / OOK", "Sensitivity": "-148 dBm" }
  },
  {
    mpn: "NEO-6M-GPS",
    name: "NEO-6M GPS Module with Antenna",
    manufacturer: "u-blox",
    description: "GPS receiver module with patch antenna, built-in EEPROM for configuration data, serial interface.",
    imageUrl: "https://robu.in/wp-content/uploads/2015/09/neo-6m-gps-module.jpg",
    datasheetUrl: "https://www.u-blox.com/sites/default/files/products/documents/NEO-6_DataSheet_%28GPS.G6-HW-09010%29.pdf",
    available: 1100,
    price: 450,
    category: "Comms",
    wokwiPartType: "wokwi-neo6m-gps",
    specs: { "Receiver Type": "50-channel u-blox 6 engine", "Update Rate": "5 Hz", "Interface": "UART Serial" }
  },

  // === Passives ===
  {
    mpn: "LED-5MM-RED",
    name: "Red LED 5mm",
    manufacturer: "Generic",
    description: "Standard 5mm diffused red light emitting diode, operating voltage 1.8V to 2.2V.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/5mm-red-led.jpg",
    datasheetUrl: "https://docs.arduino.cc/resources/datasheets/LED.pdf",
    available: 20000,
    price: 2,
    category: "Passives",
    wokwiPartType: "wokwi-led",
    specs: { "Diameter": "5 mm", "Color": "Red", "Forward Voltage": "1.8V - 2.2V", "Forward Current": "20 mA" }
  },
  {
    mpn: "RESISTOR-220R-1/4W",
    name: "Resistor 220 Ohm 1/4W",
    manufacturer: "Generic",
    description: "220 Ohm through-hole carbon film resistor, 1/4 Watt, ±5% tolerance. Commonly used for LED current limiting.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/220-ohm-resistor.jpg",
    datasheetUrl: "https://cdn.sparkfun.com/datasheets/Components/General/carbonfilmresistors.pdf",
    available: 50000,
    price: 1,
    category: "Passives",
    wokwiPartType: "wokwi-resistor",
    specs: { "Resistance": "220 Ω", "Power Rating": "0.25 W", "Tolerance": "±5%" }
  },
  {
    mpn: "RESISTOR-10K-1/4W",
    name: "Resistor 10k Ohm 1/4W",
    manufacturer: "Generic",
    description: "10k Ohm through-hole carbon film resistor, 1/4 Watt, ±5% tolerance. Standard pull-up or pull-down resistor.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/10k-resistor.jpg",
    datasheetUrl: "https://cdn.sparkfun.com/datasheets/Components/General/carbonfilmresistors.pdf",
    available: 50000,
    price: 1,
    category: "Passives",
    wokwiPartType: "wokwi-resistor",
    specs: { "Resistance": "10 kΩ", "Power Rating": "0.25 W", "Tolerance": "±5%" }
  },
  {
    mpn: "CAPACITOR-100UF-25V",
    name: "Electrolytic Capacitor 100uF 25V",
    manufacturer: "Generic",
    description: "100uF radial electrolytic capacitor rated for 25V, ±20% tolerance, for power filtering.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/100uf-capacitor.jpg",
    datasheetUrl: "https://www.mouser.com/datasheet/2/293/e-11005.pdf",
    available: 15000,
    price: 5,
    category: "Passives",
    wokwiPartType: "wokwi-capacitor",
    specs: { "Capacitance": "100 µF", "Voltage Rating": "25 V DC", "Tolerance": "±20%" }
  },
  {
    mpn: "CAPACITOR-100NF-50V",
    name: "Ceramic Capacitor 100nF (0.1uF)",
    manufacturer: "Generic",
    description: "100nF through-hole multilayer ceramic capacitor (MLCC), rated for 50V, standard decoupling capacitor.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/100nf-ceramic-capacitor.jpg",
    datasheetUrl: "https://www.mouser.com/datasheet/2/40b/kyocera_avx_06052021_SRSeries-2325330.pdf",
    available: 30000,
    price: 2,
    category: "Passives",
    wokwiPartType: "wokwi-capacitor",
    specs: { "Capacitance": "0.1 µF (100 nF)", "Voltage Rating": "50 V DC", "Code": "104" }
  },
  {
    mpn: "TACTILE-SWITCH-6MM",
    name: "Push Button Tactile Switch 6mm",
    manufacturer: "Generic",
    description: "Miniature 6x6mm through-hole momentary tactile push button switch, 4 pins.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/6mm-push-button.jpg",
    datasheetUrl: "https://components101.com/sites/default/files/component-datasheet/Push-Button-Datasheet.pdf",
    available: 40000,
    price: 3,
    category: "Passives",
    wokwiPartType: "wokwi-pushbutton",
    specs: { "Dimensions": "6 x 6 x 5 mm", "Contact Type": "Momentary", "Max Current": "50 mA" }
  },
  {
    mpn: "RELAY-5V-SRD-S-C",
    name: "Buzzer / Relay 5V 1-Channel Module",
    manufacturer: "Songle",
    description: "5V active relay interface board module with optocoupler protection, drives high current loads up to 10A.",
    imageUrl: "https://robu.in/wp-content/uploads/2014/08/5v-relay-module.jpg",
    datasheetUrl: "https://www.songle.com/pdf/srd.pdf",
    available: 3000,
    price: 65,
    category: "Passives",
    wokwiPartType: "wokwi-relay-module",
    specs: { "Control Signal": "TTL 5V", "AC Max Load": "10A @ 250V AC", "DC Max Load": "10A @ 30V DC" }
  }
];

async function seed() {
  console.log("🚀 Starting Curated Parts DB Seeding...");
  await connectDB();

  let insertCount = 0;
  for (const part of CURATED_PARTS) {
    try {
      console.log(`Seeding: ${part.name} (MPN: ${part.mpn})...`);
      await Part.findOneAndUpdate(
        { mpn: part.mpn },
        { $set: part },
        { upsert: true, new: true }
      );
      insertCount++;
    } catch (err: any) {
      console.error(`Failed to seed ${part.name}:`, err.message || err);
    }
  }

  console.log(`🎉 Seeding complete! Successfully seeded/updated ${insertCount} parts.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed critically:", err);
  process.exit(1);
});
