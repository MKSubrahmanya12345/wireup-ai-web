# ??$$$ - Virtual ESP32 Firmware Emulator
import asyncio
import json
import logging
import time
import websockets

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)

# ??$$$ - Client registries for phone and simulator connections
phone_clients = set()
simulator_clients = set()

# ??$$$ - Battery state and time tracking variables
battery = 100.0
last_packet_time = None

def map_pwm(throttle, pitch, roll, yaw, motor):
    """
    ??$$$ - Map joystick inputs to microsecond PWM values for X-frame quadcopter.
    Base range is 1000us (idle) to 2000us (max thrust).
    """
    # Normalize throttle from [-1.0, 1.0] to [0.0, 1.0]
    throttle_norm = max(0.0, min(1.0, (throttle + 1.0) / 2.0))
    base = 1000.0 + (throttle_norm * 1000.0)
    
    # Standard quadcopter X-frame mixing
    if motor == 1: # Front-Left (CW)
        pwm = base - pitch * 200.0 - roll * 200.0 + yaw * 100.0
    elif motor == 2: # Front-Right (CCW)
        pwm = base - pitch * 200.0 + roll * 200.0 - yaw * 100.0
    elif motor == 3: # Rear-Right (CW)
        pwm = base + pitch * 200.0 + roll * 200.0 + yaw * 100.0
    elif motor == 4: # Rear-Left (CCW)
        pwm = base + pitch * 200.0 - roll * 200.0 - yaw * 100.0
    else:
        pwm = 1000.0
        
    # Clamp to physical servo limits
    return max(1000, min(2000, int(round(pwm))))

async def phone_handler(websocket, path="/"):
    # ??$$$ - Handler for phone (AERO-LINK) on port 8765
    global battery, last_packet_time
    phone_clients.add(websocket)
    logging.info(f"Phone controller connected from {websocket.remote_address}")
    
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                logging.warning("Received invalid JSON payload from phone")
                continue
                
            # ??$$$ - Reset logic handling
            if data.get("action") == "reset":
                battery = 100.0
                last_packet_time = None
                logging.info("Reset command received. Battery set to 100%.")
                
                # Forward reset command to simulator on port 8766
                reset_msg = json.dumps({"action": "reset"})
                if simulator_clients:
                    await asyncio.gather(
                        *[client.send(reset_msg) for client in simulator_clients],
                        return_exceptions=True
                    )
                
                # Reply to phone with reset status ACK
                ack_msg = json.dumps({"action": "ack", "battery": 100, "ts": 0})
                await websocket.send(ack_msg)
                continue
                
            # ??$$$ - Normal control packet handling
            if "throttle" in data:
                throttle = float(data.get("throttle", 0.0))
                pitch = float(data.get("pitch", 0.0))
                roll = float(data.get("roll", 0.0))
                yaw = float(data.get("yaw", 0.0))
                ts = data.get("ts", 0)
                
                # Calculate time delta for battery drainage
                now = time.time()
                dt = 0.0
                if last_packet_time is not None:
                    dt = now - last_packet_time
                last_packet_time = now
                
                # Run PWM mapping
                m1 = map_pwm(throttle, pitch, roll, yaw, motor=1)
                m2 = map_pwm(throttle, pitch, roll, yaw, motor=2)
                m3 = map_pwm(throttle, pitch, roll, yaw, motor=3)
                m4 = map_pwm(throttle, pitch, roll, yaw, motor=4)
                
                # Cut motors if battery is completely exhausted
                if battery <= 0:
                    m1 = m2 = m3 = m4 = 1000
                
                # Calculate battery drain based on average PWM
                avg_pwm = (m1 + m2 + m3 + m4) / 4.0
                normalized_power = (avg_pwm - 1000.0) / 1000.0
                drain_rate = 0.15 + (normalized_power * 0.65) # % per second
                battery = max(0.0, battery - drain_rate * dt)
                
                # ??$$$ - Send control packet + mapped PWM values + battery status to simulator
                sim_packet = {
                    "throttle": throttle,
                    "pitch": pitch,
                    "roll": roll,
                    "yaw": yaw,
                    "motor_pwm": [m1, m2, m3, m4],
                    "battery": int(round(battery)),
                    "ts": ts
                }
                sim_msg = json.dumps(sim_packet)
                if simulator_clients:
                    await asyncio.gather(
                        *[client.send(sim_msg) for client in simulator_clients],
                        return_exceptions=True
                    )
                
                # ??$$$ - Send ACK back to the phone controller
                ack_packet = {
                    "action": "ack",
                    "battery": int(round(battery)),
                    "ts": ts
                }
                await websocket.send(json.dumps(ack_packet))
                
    except websockets.exceptions.ConnectionClosed:
        logging.info(f"Phone controller disconnected: {websocket.remote_address}")
    finally:
        if websocket in phone_clients:
            phone_clients.remove(websocket)

async def simulator_handler(websocket, path="/"):
    # ??$$$ - Handler for simulator (index.html) on port 8766
    global battery, last_packet_time
    simulator_clients.add(websocket)
    logging.info(f"Simulator connected from {websocket.remote_address}")
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                if data.get("action") == "reset":
                    battery = 100.0
                    last_packet_time = None
                    logging.info("Reset command received from simulator. Battery set to 100%.")
                    # Forward reset to phone clients
                    reset_msg = json.dumps({"action": "reset"})
                    if phone_clients:
                        await asyncio.gather(
                            *[client.send(reset_msg) for client in phone_clients],
                            return_exceptions=True
                        )
            except Exception as e:
                logging.error(f"Error handling simulator message: {e}")
    except websockets.exceptions.ConnectionClosed:
        logging.info(f"Simulator disconnected: {websocket.remote_address}")
    finally:
        if websocket in simulator_clients:
            simulator_clients.remove(websocket)

async def main():
    # ??$$$ - Serve phone on port 8765, simulator on port 8766
    async with websockets.serve(phone_handler, "0.0.0.0", 8765), \
               websockets.serve(simulator_handler, "0.0.0.0", 8766):
        logging.info("Started virtual ESP32 firmware emulator:")
        logging.info("  Phone Controller connects to: ws://localhost:8765")
        logging.info("  Simulator connects to: ws://localhost:8766")
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Shutting down virtual ESP32 server...")
