# WireUp Component Ingestion System



## Context



WireUp is an electronics simulation platform.



The platform must support thousands of electronic components without manually editing a registry file.



Build an internal Component Ingestion System that acts as a Component CMS and Registry Generation Platform.



This is an admin-only feature.



Route:



/admin/ingestion



---



## Goal



Allow administrators to ingest electronic components, review extracted metadata, generate registry entries, and publish components into WireUp's component registry.



The system should provide a complete end-to-end workflow from part number or datasheet to registry generation.



---



## Technology Stack



### Frontend



* React

* JavaScript

* Vite

* React Router

* Axios



### Backend



* Node.js

* Express

* TypeScript

* MongoDB

* Mongoose

* Zod



---



## Supported Component Families



CONTROLLER



SERVO



STEPPER



DC_MOTOR



RELAY



BUZZER



LED



RGB_LED



LCD



OLED



SEVEN_SEGMENT



BUTTON



TOGGLE_SWITCH



DIP_SWITCH



ROTARY_ENCODER



POTENTIOMETER



JOYSTICK



KEYPAD



ULTRASONIC



IR_RECEIVER



IR_TRANSMITTER



DHT11



DHT22



BME280



BMP280



MQ_SENSOR



PIR_SENSOR



LDR



RTC



EEPROM



SD_CARD



RFID



NFC



GPS



BLUETOOTH



WIFI_MODULE



LORA



NRF24



CAN_MODULE



RS485



I2C_EXPANDER



SHIFT_REGISTER



MOTOR_DRIVER



STEPPER_DRIVER



MOSFET



TRANSISTOR



OPAMP



ADC



DAC



POWER_REGULATOR



BATTERY



---



## User Workflow



Administrator enters:



* Part Number

* Datasheet URL



Example:



* MG90S

* HC-SR04

* ESP32

* A4988



The ingestion pipeline should:



1. Search component metadata

2. Fetch datasheet

3. Parse datasheet

4. Extract pin information

5. Classify component family

6. Determine category

7. Generate configuration defaults

8. Generate runtime defaults

9. Build registry entry

10. Validate registry entry

11. Save component

12. Generate registry snapshot



---



## Component Search



Implement a provider architecture.



Provide a working ManualProvider implementation.



Design the system so future providers such as Nexar or Octopart can be added without changing business logic.



---



## Datasheet Processing



Support:



* PDF datasheets

* HTML datasheets



Recommended libraries:



* pdf-parse

* cheerio



Extract:



* Title

* Manufacturer

* Description

* Electrical characteristics

* Tables

* Pin information

* Relevant sections



---



## Family Classification



Implement a deterministic classifier using:



* Part number

* Component title

* Description

* Datasheet text



Use weighted keyword matching.



Examples:



MG90S → SERVO



HC-SR04 → ULTRASONIC



ESP32 → CONTROLLER



A4988 → STEPPER_DRIVER



The classifier should support all defined families.



---



## Category Classification



Automatically derive category from family.



---



## Pin Extraction



Extract:



* Pin number

* Pin name

* Pin type

* Pin description

* Bus capabilities



Recognize:



* GPIO

* PWM

* UART

* SPI

* I2C

* ADC

* DAC

* GND

* VCC

* RST

* EN

* CLK



---



## Registry Generation



Generate a normalized JSON registry entry.



Each entry should contain:



* id

* family

* category

* name

* manufacturer

* partNumber

* wokwiType

* pins

* configDefaults

* runtimeDefaults



Registry generation should be deterministic.



Include:



* Version

* Timestamp

* SHA256 checksum



---



## Validation



Validate:



* Required fields

* Duplicate pins

* Missing family

* Missing category

* Invalid mappings

* Invalid registry structure



Return detailed validation results.



---



## MongoDB Collections



components



component_versions



ingestion_jobs



registry_snapshots



---



## Components Collection



Store:



* partNumber

* manufacturer

* name

* description

* family

* category

* datasheetUrl

* imageUrl

* wokwiType

* pins

* configDefaults

* runtimeDefaults

* metadata

* createdAt

* updatedAt



---



## API Endpoints



POST /api/ingestion/search



POST /api/ingestion/import



POST /api/ingestion/validate



POST /api/ingestion/generate-registry



GET /api/ingestion/jobs



GET /api/ingestion/components



GET /api/ingestion/components/:id



---



## Frontend



Build a complete admin dashboard.



Include:



* Search Panel

* Search Results

* Datasheet Viewer

* Family Editor

* Category Editor

* Pin Editor

* Config Editor

* Runtime Editor

* Registry Preview

* Validation Panel

* Import History



The UI should feel like an internal engineering tool rather than a marketing page.



---



## Project Structure



Use a clean production-oriented structure separating:



* Models

* Schemas

* Validators

* Repositories

* Services

* Controllers

* Routes

* Parsers

* Classifiers

* Registry Logic

* React Pages

* React Components



---



## Delivery



Generate the complete implementation.



Provide fully working files with correct imports and dependencies.



Ensure backend and frontend can run independently after dependency installation and environment configuration.



Where implementation details are not explicitly specified, make reasonable engineering decisions and continue.





