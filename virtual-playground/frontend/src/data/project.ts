import type { ProjectData } from '../types/project';

export const projectData: ProjectData = {
  id: 'starter-project',
  name: 'Virtual Playground Starter',
  description: 'Load a formulated project payload to simulate its real sketch, wiring, and components.',
  author: 'Virtual Playground',
  createdAt: '2026-06-06',
  bom: [],
  wiring: [],
  editableJson: {
    simulationSpeed: 1,
    ledInitialState: false,
    buttonInitialState: false
  },
  sketch: `// Starter sketch placeholder.
// Real behavior should come from the loaded project payload.

void setup() {
}

void loop() {
}
`
};
