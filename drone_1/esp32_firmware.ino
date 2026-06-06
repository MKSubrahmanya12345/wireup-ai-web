// Flash this to ESP32 to replace the virtual emulator
// ??$$$ - ESP32 Drone Firmware Sketch
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ??$$$ - WiFi network configuration (Modify as needed)
const char* ssid = "YourNetworkSSID";
const char* password = "YourNetworkPassword";

// ??$$$ - Port configuration matching physical / virtual mapping
WebSocketsServer webSocket = WebSocketsServer(8765);

// ??$$$ - Servo ESC handles
Servo esc1; // M1 Front-Left
Servo esc2; // M2 Front-Right
Servo esc3; // M3 Rear-Right
Servo esc4; // M4 Rear-Left

// Pin assignments matching wiring.json
const int ESC1_PIN = 13; // GPIO 13 (M1 Front-Left)
const int ESC2_PIN = 12; // GPIO 12 (M2 Front-Right)
const int ESC3_PIN = 14; // GPIO 14 (M3 Rear-Right)
const int ESC4_PIN = 27; // GPIO 27 (M4 Rear-Left)
const int LED_PIN = 2;   // Built-in status LED
const int BATTERY_PIN = 34; // GPIO 34 for analog voltage reading

// ??$$$ - Read battery voltage and map to 0-100%
int getBatteryPercentage() {
  int rawADC = analogRead(BATTERY_PIN);
  
  // ESP32 ADC resolution is 12-bit (0-4095).
  // Assuming a voltage divider (e.g. 100k / 27k) to map battery max 12.6V to ESP32 3.3V range.
  // 9.9V empty cell value ~ 2700 ADC count
  // 12.6V fully charged value ~ 3400 ADC count
  int percent = map(rawADC, 2700, 3400, 0, 100);
  
  if (percent > 100) percent = 100;
  if (percent < 0) percent = 0;
  return percent;
}

// ??$$$ - Core WebSocket Event Handler
void webSocketEvent(uint8_t num, WSevent_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WSevent_t::WSEVENT_DISCONNECTED:
      // Turn off onboard LED and trigger Failsafe (shut down motors) on disconnect
      digitalWrite(LED_PIN, LOW);
      esc1.writeMicroseconds(1000);
      esc2.writeMicroseconds(1000);
      esc3.writeMicroseconds(1000);
      esc4.writeMicroseconds(1000);
      Serial.printf("[%u] Link Disconnected. Motors Disarmed.\n", num);
      break;
      
    case WSevent_t::WSEVENT_CONNECTED:
      // Turn on onboard LED to indicate link established
      digitalWrite(LED_PIN, HIGH);
      Serial.printf("[%u] Link Established.\n", num);
      break;
      
    case WSevent_t::WSEVENT_TEXT: {
      StaticJsonDocument<256> doc;
      DeserializationError error = deserializeJson(doc, payload, length);
      if (error) {
        Serial.println("Error parsing incoming JSON packet");
        return;
      }
      
      // ??$$$ - Handle Reset command
      if (doc.containsKey("action") && doc["action"] == "reset") {
        Serial.println("System reset command received.");
        esc1.writeMicroseconds(1000);
        esc2.writeMicroseconds(1000);
        esc3.writeMicroseconds(1000);
        esc4.writeMicroseconds(1000);
        
        // Blink LED to indicate reset
        digitalWrite(LED_PIN, LOW);
        delay(100);
        digitalWrite(LED_PIN, HIGH);
        
        // Send ACK back
        StaticJsonDocument<128> response;
        response["action"] = "ack";
        response["battery"] = getBatteryPercentage();
        response["ts"] = 0;
        String responseString;
        serializeJson(response, responseString);
        webSocket.sendTXT(num, responseString);
        return;
      }
      
      // ??$$$ - Handle standard control packet
      if (doc.containsKey("throttle")) {
        float throttle = doc["throttle"]; // Range: [-1.0, 1.0]
        float pitch = doc["pitch"];       // Range: [-1.0, 1.0]
        float roll = doc["roll"];         // Range: [-1.0, 1.0]
        float yaw = doc["yaw"];           // Range: [-1.0, 1.0]
        long long ts = doc["ts"];
        
        // Normalize throttle to [0.0, 1.0]
        float throttle_normalized = (throttle + 1.0) / 2.0;
        if (throttle_normalized < 0.0) throttle_normalized = 0.0;
        if (throttle_normalized > 1.0) throttle_normalized = 1.0;
        
        // Map to base microsecond rate (1000us - 2000us)
        float base = 1000.0 + (throttle_normalized * 1000.0);
        
        // Mix inputs according to quadcopter X-frame logic
        float m1 = base - pitch * 200.0 - roll * 200.0 + yaw * 100.0;
        float m2 = base - pitch * 200.0 + roll * 200.0 - yaw * 100.0;
        float m3 = base + pitch * 200.0 + roll * 200.0 + yaw * 100.0;
        float m4 = base + pitch * 200.0 - roll * 200.0 - yaw * 100.0;
        
        // Clamp outputs to safe physical ESC limits [1000us, 2000us]
        int pwm1 = constrain((int)round(m1), 1000, 2000);
        int pwm2 = constrain((int)round(m2), 1000, 2000);
        int pwm3 = constrain((int)round(m3), 1000, 2000);
        int pwm4 = constrain((int)round(m4), 1000, 2000);
        
        // Write pulses to ESCs
        esc1.writeMicroseconds(pwm1);
        esc2.writeMicroseconds(pwm2);
        esc3.writeMicroseconds(pwm3);
        esc4.writeMicroseconds(pwm4);
        
        // ??$$$ - Send ACK packet back to the controller
        StaticJsonDocument<128> response;
        response["action"] = "ack";
        response["battery"] = getBatteryPercentage();
        response["ts"] = ts;
        String responseString;
        serializeJson(response, responseString);
        webSocket.sendTXT(num, responseString);
      }
      break;
    }
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  
  // Set GPIO pin modes
  pinMode(LED_PIN, OUTPUT);
  pinMode(BATTERY_PIN, INPUT);
  digitalWrite(LED_PIN, LOW); // Start with LED off (unconnected status)
  
  // ??$$$ - Attach ESCs using ESP32Servo library API
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  
  esc1.attach(ESC1_PIN, 1000, 2000);
  esc2.attach(ESC2_PIN, 1000, 2000);
  esc3.attach(ESC3_PIN, 1000, 2000);
  esc4.attach(ESC4_PIN, 27, 1000, 2000); // Attach ESC4 to pin 27
  
  // Send idle signals initially
  esc1.writeMicroseconds(1000);
  esc2.writeMicroseconds(1000);
  esc3.writeMicroseconds(1000);
  esc4.writeMicroseconds(1000);
  
  // ??$$$ - Establish WiFi Access Point Connection
  Serial.print("Connecting to network: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.print("WiFi Connected. IP address: ");
  Serial.println(WiFi.localIP());
  
  // Start WebSockets server
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  
  Serial.println("WebSocket Control Server Initialized on Port 8765.");
}

void loop() {
  // ??$$$ - Process WebSocket network events loop
  webSocket.loop();
}
