// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// @ts-nocheck
import React from 'react';
import { Cpu, Zap, ToggleLeft, CircleDot } from 'lucide-react';

export const COMPONENT_LIBRARY = [
  {
    label: 'Microcontrollers',
    icon: <Cpu className="h-3.5 w-3.5" />,
    items: [
      {
        type: 'wokwi-arduino-mega',
        label: 'Arduino Mega',
        description: 'ATmega2560 @ 16 MHz',
        defaultAttrs: {},
        icon: <Cpu className="h-4 w-4 text-indigo-500" />,
      },
      {
        type: 'wokwi-arduino-uno',
        label: 'Arduino Uno',
        description: 'ATmega328P @ 16 MHz',
        defaultAttrs: {},
        icon: <Cpu className="h-4 w-4 text-indigo-400" />,
      },
    ],
  },
  {
    label: 'Outputs',
    icon: <Zap className="h-3.5 w-3.5" />,
    items: [
      {
        type: 'wokwi-led',
        label: 'LED (Red)',
        description: 'Light-emitting diode',
        defaultAttrs: { color: 'red' },
        icon: <CircleDot className="h-4 w-4 text-red-400" />,
      },
      {
        type: 'wokwi-led',
        label: 'LED (Blue)',
        description: 'Light-emitting diode',
        defaultAttrs: { color: 'blue' },
        icon: <CircleDot className="h-4 w-4 text-blue-400" />,
      },
      {
        type: 'wokwi-led',
        label: 'LED (Green)',
        description: 'Light-emitting diode',
        defaultAttrs: { color: 'green' },
        icon: <CircleDot className="h-4 w-4 text-green-400" />,
      },
      {
        type: 'wokwi-7segment',
        label: '7-Segment',
        description: 'Single-digit display',
        defaultAttrs: {},
        icon: <span className="text-[10px] font-mono font-bold text-amber-400">7SEG</span>,
      },
      {
        type: 'wokwi-servo',
        label: 'Servo Motor',
        description: 'Standard 180° servo',
        defaultAttrs: {},
        icon: <Zap className="h-4 w-4 text-amber-500" />,
      },
    ],
  },
  {
    label: 'Inputs',
    icon: <ToggleLeft className="h-3.5 w-3.5" />,
    items: [
      {
        type: 'wokwi-pushbutton',
        label: 'Push Button',
        description: 'Momentary tactile switch',
        defaultAttrs: { color: 'green' },
        icon: <ToggleLeft className="h-4 w-4 text-green-400" />,
      },
      {
        type: 'wokwi-slide-switch',
        label: 'Slide Switch',
        description: 'SPDT slide switch',
        defaultAttrs: {},
        icon: <ToggleLeft className="h-4 w-4 text-sky-400" />,
      },
      {
        type: 'wokwi-ir-receiver',
        label: 'IR Receiver',
        description: 'Infrared remote receiver',
        defaultAttrs: {},
        icon: <Zap className="h-4 w-4 text-emerald-400" />,
      },
      {
        type: 'wokwi-ir-remote',
        label: 'IR Remote',
        description: '21-key infrared remote',
        defaultAttrs: {},
        icon: <Zap className="h-4 w-4 text-emerald-400" />,
      },
    ],
  },
];

