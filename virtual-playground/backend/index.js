// ??$$$
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Mock project database store
const mockProject = {
  id: "project-001",
  name: "Arduino LED Switch Demo (Express REST)",
  description: "Basic interactive LED simulation served from Node backend",
  author: "Virtual Playground",
  createdAt: "2026-05-28",
  bom: [
    {
      key: "arduino",
      displayName: "Arduino Uno",
      type: "microcontroller",
      glbUrl: "/models/arduino.glb",
      position: [0, 0.05, 0],
      pins: [
        { id: "5V", x: -1.2, y: 0.1, z: 0.4, type: "power" },
        { id: "GND", x: -1.2, y: 0.1, z: 0.8, type: "gnd" },
        { id: "D7", x: 1.2, y: 0.1, z: -0.4, type: "digital" },
        { id: "D2", x: 1.2, y: 0.1, z: -0.8, type: "digital" }
      ]
    },
    {
      key: "led1",
      displayName: "Red LED",
      type: "led",
      glbUrl: "/models/led.glb",
      position: [2.5, 0.2, 0.5],
      pins: [
        { id: "A", x: 0, y: 0, z: 0, type: "anode" },
        { id: "C", x: 0.3, y: 0, z: 0, type: "cathode" }
      ]
    },
    {
      key: "button1",
      displayName: "Push Button",
      type: "button",
      glbUrl: "/models/button.glb",
      position: [-2.5, 0.15, -0.5],
      pins: [
        { id: "1", x: 0, y: 0, z: 0, type: "digital" },
        { id: "2", x: 0.3, y: 0, z: 0, type: "digital" }
      ]
    }
  ],
  wiring: [
    { from: "arduino.D7", to: "led1.A", color: "#ff0000" },
    { from: "led1.C", to: "arduino.GND", color: "#000000" },
    { from: "button1.1", to: "arduino.D2", color: "#00ffcc" }
  ],
  editableJson: {
    simulationSpeed: 1,
    ledInitialState: false,
    buttonInitialState: false
  },
  sketch: `// Arduino LED Switch Demo Sketch
const int ledPin = 7;
const int buttonPin = 2;

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT);
  Serial.begin(9600);
}

void loop() {
  int buttonState = digitalRead(buttonPin);
  if (buttonState == HIGH) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}
`
};

// REST API Endpoints
app.get('/api/project', (req, res) => {
  console.log('[API] GET /api/project requested - serving hardware project schema');
  res.json(mockProject);
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', database: 'mock-local-memory', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 MERN BACKEND SERVER RUNNING ON PORT ${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/project`);
  console.log(`==================================================`);
});
