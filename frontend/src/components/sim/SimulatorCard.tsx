// @ts-nocheck
import React from 'react';
import SimulatorWorkspace from './SimulatorWorkspace';

export default function SimulatorCard({ title = 'Simulator' }) {
  return (
    <div className="w-full h-full">
      <SimulatorWorkspace embedded />
    </div>
  );
}

