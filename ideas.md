<!-- ??$$$ non-important -->
So, the ai must decide on how many building blocks it needs to complete the project.

For ex: Your quadcopter consists of three active building blocks; a radio control system,
flight controller and powertrain

And also it must divide components into each building part

For ex: frame, flight controller, powertrain, Battery, Radio control
here, put the frame and battery into any phases where its needed.

and also each block has phases, like above 5 phase not to be confused with 3 blocks

ADDITIONAL TOOLS needed: ( this is to be helpful during the building process ( any block can be used in ))
Ai should suggest these under additional tools
Additional required tools and material

For ex:

To complete your build, you also require some additional tools and material. Except
for a computer, these are only necessary when starting the actual build, not when
testing the components in the first projects (except if you still need to solder headers
to your Teensy and sensors in order to test them on the breadboard).
• a soldering iron or station, to solder the motors wires, ESCs, resistors, LEDs
and male/ female headers to each other / the printed circuit frame on you quadcopter frame.
• sufficient solder material.
• a soldering helping hand to clamp the parts you are soldering together.
• a wire stripper to strip the electrical insulation from the ESC and motor wires.
• a wire cutter to cut the ESC and motor wires.
• a computer capable of running Arduino (see arduino.cc/en/software)
• two hex keys (1.5 mm and 2 mm)
• a multimeter to check for short-circuits or bad connections

Now continuing this DRONE example:

1. Connect your new Teensy to your computer using the USB cable (see figure to the
right).
2. Your Teensy should come with the LED blink program pre-loaded; this means
that the orange LED on your Teensy should blink slowly after connection with your
computer.
3. Press and release the tiny pushbutton on the Teensy. The orange blinking LED
should stop and the red Teensy LED should be visible. This means your Teensy
works correctly.
4. Disconnect your Teensy from your computer by disconnecting the USB cable.
File Edit Sketch Tools Help
void setup() {
pinMode(13, OUTPUT);
}
void loop() {
digitalWrite(13, HIGH);
delay(500);
digitalWrite(13, LOW);
delay(500);
}
BLINK
Verify Upload
serial monitor
Setup your microcontroller for programming
Ca rbon aeronautics
19
3V 22 19 18 21 20 16
7 5
14
8 6 3 4 9 0
5V G 2 15 17 10 11
UsB connection to
your computer
micro-B connection
to your Teensy
orange Teensy LEd
(pin 13)
red Teensy LEd
(bootloader status)
pushbutton
microcontroller
Teensy 4.0 2a
microcontroller connector
USB A to micro B 2b
5. Download and install the Teensy Loader program, which communicates with your
Teensy board. Guidance on the installation process can be found at pjrc.com/teensy/
loader.html. Click on the operating system of your computer, read the information
and click on the Teensy Loader link to start downloading.
6. If you do not have the Arduino software (IDE) yet, download the latest version
from arduino.cc/download and install it on your computer. Guidance on the installation process can be found at arduino.cc/en/Guide/Windows or arduino.cc/en/
Guide/MacOSX or arduino.cc/en/Guide/Linux.
7. The final piece of software to install is Teensyduino, the software add-on for Arduino. Download it by going to pjrc.com/teensy/td_download.html and follow the
instructions on this webpage.
8. Open the Arduino IDE; a new empty sketch should load automatically. Copy the
code in the figure to the left of this page and save the file under the name BLINK.
Now click on ‘Verify’. You will first have to save your sketch. After verification, you
should view the message ‘Done Compiling’ below on your screen. If you get an error,
verify whether you copied the code correctly.
20
Concept, parts and programming
9. Before you can upload your verified code to your Teensy, you need to setup your
Teensy in the Arduino IDE. Go to tools and:
• Click on ‘Boards’ and ‘Teensyduino’ and select the Teensy 4.0 board.
• Verify that the USB type is ‘Serial’.
• Verify that the CPU speed is 600 MHz.
• Connect your Teensy again with your computer using the USB cable. Under
Port, a USB port should be displayed. Click on it.
10. Press the upload button on the screen. The internal Teensy LED should start
blinking again. Change the blinking speed by changing the delay time of 500 (milliseconds) in the code to for example 100 (milliseconds) to blink faster, or 1000 (milliseconds) to blink slower. Adapt and upload the code to verify that you are truly in
control of the Teensy. When this test is successful, you are ready for the next project!

CODE COMPATIBILITY:
The code throughout this book is compatible with the following Arduino (library)
versions:
• Arduino IDE: 1.8.16
• Teensyduino: 1.55
• BasicLinearAlgebra library: 3.2.0 (only necessary for part III)
Ca rbon aeronautics
21
File Edit Sketch Tools Help
void setup() {
pinMode(13, OUTPUT);
}
void loop() {
digitalWrite(13, HIGH);
delay(500);
digitalWrite(13, LOW);
delay(500);
}
BLINK
Auto Format Ctrl+T
Archive Sketch
Fix Encoding & Reload
Manage Libraries... Ctrl+Shift+I
Serial Monitor Ctrl+Shift+M
Serial Plotter Ctrl+Shift+L
WiFi101/WifiNINA Firmware Updater
Board: “Teensy 4.0”
USB Type: “Serial”
CPU Speed: “600 MHz”
Optimize: “Faster”
Keyboard Layout: “US English”
Port
Get Board Info
Programmer: “AVRISP mkll”
Burn Bootloader
Solder pins to your microcontroller and sensors
You will use a breadboard to separately test the electronic components of your flight
controller. To be able to electrically connect the components with the breadboard,
you need to use straight male header pins that are soldered to your Teensy microcontroller, the MPU-6050 gyroscope and the BMP-280 pressure sensor. If these parts do
not come pre-soldered with header pins, you will need to solder them yourself.
For easy soldering, you can insert the pins in your breadboard and put the component
on top such that the pins are soldered straight to the microcontroller and sensors. If
you have never soldered before, you can consult the internet for some tutorials.


AI MUST GUIDE USER THR THIS:

for ex: battery phase, its like to code a part to make an led show colour based on the battery level, stuff like that

float Voltage;
2 void battery_voltage(void) {
3 Voltage=(float)analogRead(15)/62;
4 }
5 void setup() {
6 Serial.begin(57600);

pinMode(13, OUTPUT);
8 digitalWrite(13, HIGH);
9 }
10 void loop() {
11 battery_voltage();
12 Serial.print(Voltage);
13 Serial.println("V");
14 delay(50);
15 }

something like above, again for this we need an interface to code + run + debug, etc


Sensing the rotation rate ( again a phase ):

 #include <Wire.h>
2 float RateRoll, RatePitch, RateYaw;
3 void gyro_signals(void) {
4 Wire.beginTransmission(0x68);

something like this;

TESTING above:
Upload the code to your microcontroller and open the serial monitor. You will notice
that not all values are equal to zero even though you do not move the MPU-6050:
Roll rate [°/s]= -8.70 Pitch Rate [°/s]= 0.89 Yaw Rate [°/s]= 1.95
Roll rate [°/s]= -8.69 Pitch Rate [°/s]= 0.92 Yaw Rate [°/s]= 1.97
Roll rate [°/s]= -8.66 Pitch Rate [°/s]= 0.87 Yaw Rate [°/s]= 1.94
It is normal when you do not have the same values as mentioned above. You will
learn more on how to solve this phenomenon through calibration in the next project.


Then phase like gyroscopic calibration::

 #include <Wire.h>
2 float RateRoll, RatePitch, RateYaw;
3 float RateCalibrationRoll, RateCalibrationPitch,
RateCalibrationYaw;
4 int RateCalibrationNumber;
5 void gyro_signals(void) {
6 Wire.beginTransmission(0x68);
Declare the calibration variables
3V
XDA
VCC
INT
ADO
XCL
SDA
SCL
GND
MPU-6050
5V
14
15
16
17
18
19
20
21
22
0
G
11
10
9
8
7
6
5
4
3
2
Teensy
3V
48
Gyroscope calibration
In the setup part of the program, create a loop in which you take 2000 measurement
values from the gyroscope. Each value is taken 1 millisecond after the other (hence
the delay(1)) which means this step takes 2000 x 1 ms= 2 seconds. You add all measured values in the Roll/Pitch/YawRateCalibration variables. During this measurement step, it is important to not move your gyroscope as the goal is to determine the
measured values at a rotation rate of zero.
Take the average calibration value by dividing the sum of the 2000 measurement
values by 2000. Now you have the measurement values at which the rotation rates
are zero.
Once the setup is finished and you have determined the calibration values, subtract
them from the measured values in order to get the correct physical values. Print the
corrected values to the serial monitor.
7 Wire.write(0x1A);
8 Wire.write(0x05);
9 Wire.endTransmission();
10 Wire.beginTransmission(0x68);
11 Wire.write(0x1B);
12 Wire.write(0x08);
13 Wire.endTransmission();
14 Wire.beginTransmission(0x68);
15 Wire.write(0x43);
16 Wire.endTransmission();
17 Wire.requestFrom(0x68,6);
18 int16_t GyroX=Wire.read()<<8 | Wire.read();
19 int16_t GyroY=Wire.read()<<8 | Wire.read();
20 int16_t GyroZ=Wire.read()<<8 | Wire.read();

RatePitch=(float)GyroY/65.5;
23 RateYaw=(float)GyroZ/65.5;
24 }
25 void setup() {
26 Serial.begin(57600);
27 pinMode(13, OUTPUT);
28 digitalWrite(13, HIGH);
29 Wire.setClock(400000);
30 Wire.begin();
31 delay(250);
32 Wire.beginTransmission(0x68);
33 Wire.write(0x6B);
34 Wire.write(0x00);
35 Wire.endTransmission();
36 for (RateCalibrationNumber=0;
37 RateCalibrationNumber<2000;
38 RateCalibrationNumber ++) {
39 gyro_signals();
40 RateCalibrationRoll+=RateRoll;
41 RateCalibrationPitch+=RatePitch;
42 RateCalibrationYaw+=RateYaw;
43 delay(1);
44 }
45 RateCalibrationRoll/=2000;
46 RateCalibrationPitch/=2000;
47 RateCalibrationYaw/=2000;
48 }
49 void loop() {
50 gyro_signals();
51 RateRoll-=RateCalibrationRoll;
52 RatePitch-=RateCalibrationPitch;
53 RateYaw-=RateCalibrationYaw;
54 Serial.print("Roll rate [°/s]= ");
55 Serial.print(RateRoll);
56 Serial.print(" Pitch Rate [°/s]= ");
57 Serial.print(RatePitch);
58 Serial.print(" Yaw Rate [°/s]= ");
59 Serial.println(RateYaw);
60 delay(50);


then again not fixing everything together and then fucking it up:

do like test your radio, motors and ESCs

#include <PulsePosition.h>
2 PulsePositionInput ReceiverInput(RISING);
3 float ReceiverValue[]={0, 0, 0, 0, 0, 0, 0, 0};
4 int ChannelNumber=0;
5 void read_receiver(void){
6 ChannelNumber = ReceiverInput.available();
7 if (ChannelNumber > 0) {
8 for (int i=1; i<=ChannelNumber;i++){
9 ReceiverValue[i-1]=ReceiverInput.read(i);
10 }
11 }
12 }
13 void setup() {
14 Serial.begin(57600);
15 pinMode(13, OUTPUT);
16 digitalWrite(13, HIGH);
17 ReceiverInput.begin(14);
18 }
19 void loop() {
20 read_receiver();
21 Serial.print("Number of channels: ");
22 Serial.print(ChannelNumber);
23 Serial.print(" Roll [µs]: ");
24 Serial.print(ReceiverValue[0]);
25 Serial.print(" Pitch [µs]: ");
26 Serial.print(ReceiverValue[1]);
27 Serial.print(" Throttle [µs]: ");
28 Serial.print(ReceiverValue[2]);
29 Serial.print(" Yaw [µs]: ");
30 Serial.println(ReceiverValue[3]);
31 delay(50);


now this is just 25% summarise:

i used a book for this:

INDEX:

Project 1
Concept, parts and programming.................................................8
PART I: rate mode
Project 2
LED control...................................................................................24
Project 3
Reading your battery level............................................................28
Project 4
Sensing the rotation rate...............................................................34
Project 5
Gyroscope calibration...................................................................46
Project 6
Take your motors for a spin ........................................................52
Project 7
Receiving commands....................................................................58
Project 8
Controlling your motors...............................................................66
Project 9
Battery management.....................................................................72
Project 10
Assembling your quadcopter.......................................................80
Project 11
Quadcopter dynamics...................................................................86
Project 12
Quadcopter rate control...............................................................90
Project 13
The flight controller: rate mode..................................................96
Contents
Part II: stabilization mode
Project 14
Measuring angles.........................................................................110
Project 15
The Kalman filter - one dimension..........................................120
Project 16
The flight controller: stabilize mode ........................................130
Part III: velocity mode
Project 17
Measuring altitude .......................................................................142
Project 18
Measuring vertical velocity.........................................................154
Project 19
The Kalman filter - two dimensions........................................162
Project 20
The flight controller: velocity mode.........................................174
Part IV: quadcopter design and simulation
Project 21
Motor and sensor simulation.....................................................190
Project 22
Quadcopter dynamics simulation .............................................200
Project 23
Quadcopter PID controller.......................................................210
Project 24
Estimate the PID values...........


OUR Site should adapt very well for such stuff, 
not just a chat -> components -> build -> shopping, etc