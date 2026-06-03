// ??$$$ group 2 - Ideation Stage (Phase 1)
// ??$$$ NEW FLOW
import { SchemaType } from "@google/generative-ai";

export const GEMINI_AGENT2_TOOLS = {
  functionDeclarations: [
    {
      name: "search_library",
      description: "Search for electronic components by name, function, or category. Returns real parts with specs, interfaces, price, and datasheet URLs. Call this for each subsystem to find candidate components before selecting.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: {
            type: SchemaType.STRING,
            description: "Search query for the component (e.g. 'ESP32 devkit WiFi Bluetooth')"
          },
          limit: {
            type: SchemaType.NUMBER,
            description: "Maximum number of results to return (default is 5)"
          },
          category: {
            type: SchemaType.STRING,
            description: "Category filter",
            enum: ["MCU", "sensor", "motor", "ESC", "display", "power", "communication"]
          }
        },
        required: ["query"]
      }
    },
    {
      name: "get_part_details",
      description: "Get complete specifications, interfaces, pin map, and datasheet for a specific component. Call this on your top candidates before selecting to ensure they meet all requirements.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          partId: {
            type: SchemaType.STRING,
            description: "The _id or mpn from search_library results"
          }
        },
        required: ["partId"]
      }
    },
    {
      name: "check_compatibility",
      description: "Check if two components are electrically compatible. Verifies voltage levels, shared protocols, and interface availability. Call this on any two parts that must connect directly before finalizing selection.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          partIdA: {
            type: SchemaType.STRING,
            description: "First component's ID or MPN"
          },
          partIdB: {
            type: SchemaType.STRING,
            description: "Second component's ID or MPN"
          },
          connectionType: {
            type: SchemaType.STRING,
            description: "Type of connection to check",
            enum: ["power", "i2c", "spi", "uart", "pwm", "analog"]
          }
        },
        required: ["partIdA", "partIdB"]
      }
    },
    {
      name: "validate_pin_assignment",
      description: "Check that all pin assignments are valid for the chosen MCU. Detects duplicate pin usage, unavailable pins, and missing required connections. Always call this after generate_wiring completes.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          mcu: {
            type: SchemaType.STRING,
            description: "MCU name e.g. 'ESP32', 'Arduino Nano'"
          },
          assignments: {
            type: SchemaType.ARRAY,
            description: "List of pin assignments",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                pin: {
                  type: SchemaType.STRING,
                  description: "MCU pin name (e.g. 'GPIO21')"
                },
                usedBy: {
                  type: SchemaType.STRING,
                  description: "Peripheral pin connection (e.g. 'MPU6050.SDA')"
                }
              },
              required: ["pin", "usedBy"]
            }
          }
        },
        required: ["mcu", "assignments"]
      }
    },
    {
      name: "search_datasheet",
      description: "Get specific technical values from a component datasheet. Use when you need exact I2C addresses, register maps, voltage ranges, or timing values for code generation. More precise than relying on general knowledge.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          partId: {
            type: SchemaType.STRING,
            description: "Component ID or MPN"
          },
          query: {
            type: SchemaType.STRING,
            description: "Specific details to look for: 'I2C address' | 'register map' | 'voltage range' | 'timing diagram' | 'initialization sequence'"
          }
        },
        required: ["partId", "query"]
      }
    },
    {
      name: "estimate_power_budget",
      description: "Calculate total current consumption of all selected components and verify the power source is adequate. Always call this after finalizing component selection to catch power supply issues early.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          parts: {
            type: SchemaType.ARRAY,
            description: "Selected components and their quantities",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                partId: {
                  type: SchemaType.STRING,
                  description: "Component ID or MPN"
                },
                qty: {
                  type: SchemaType.NUMBER,
                  description: "Quantity"
                }
              },
              required: ["partId", "qty"]
            }
          },
          powerSource: {
            type: SchemaType.STRING,
            description: "Power source name e.g. 'USB 5V 500mA' or '4S LiPo 1300mAh'"
          }
        },
        required: ["parts", "powerSource"]
      }
    },
    {
      name: "get_wokwi_part_type",
      description: "Get the Wokwi simulator part type for a real component. Returns the wokwi part identifier needed to place this component in simulation. Call for every selected part.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          partId: {
            type: SchemaType.STRING,
            description: "Component ID or MPN"
          },
          partName: {
            type: SchemaType.STRING,
            description: "Optional fallback part name"
          }
        },
        required: ["partId"]
      }
    },
    {
      name: "check_simulation_support",
      description: "Check which components can be simulated in Wokwi and which require physical hardware. Use this to correctly mark milestones as simulatable or physical-only.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          parts: {
            type: SchemaType.ARRAY,
            description: "List of components to check",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                key: {
                  type: SchemaType.STRING,
                  description: "BOM key (e.g. 'mcu', 'gyro')"
                },
                partId: {
                  type: SchemaType.STRING,
                  description: "Component ID or MPN"
                },
                name: {
                  type: SchemaType.STRING,
                  description: "Component name"
                }
              },
              required: ["key", "partId", "name"]
            }
          }
        },
        required: ["parts"]
      }
    },
    {
      name: "generate_wiring",
      description: "Generate complete pin-level wiring connections between all selected components. Produces a connection list that can be used for code generation, diagram rendering, and the simulator. Call after finalizing component selection.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          parts: {
            type: SchemaType.ARRAY,
            description: "Components to connect",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                key: {
                  type: SchemaType.STRING,
                  description: "BOM key (e.g. 'mcu', 'gyro')"
                },
                partId: {
                  type: SchemaType.STRING,
                  description: "Component ID or MPN"
                },
                name: {
                  type: SchemaType.STRING,
                  description: "Component name"
                },
                role: {
                  type: SchemaType.STRING,
                  description: "Role of the component (e.g. 'controller', 'sensor', 'actuator', 'power', 'display')"
                }
              },
              required: ["key", "partId", "name", "role"]
            }
          },
          mcu: {
            type: SchemaType.STRING,
            description: "MCU name for mapping"
          }
        },
        required: ["parts", "mcu"]
      }
    },
    {
      name: "generate_milestone",
      description: "Generate a complete build milestone including code, wiring instructions, explanation, and test criteria for one subsystem. Call once per milestone in order. Always start with bare MCU blink as milestone 1.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          title: {
            type: SchemaType.STRING,
            description: "Milestone title"
          },
          objective: {
            type: SchemaType.STRING,
            description: "Milestone objective description"
          },
          subsystem: {
            type: SchemaType.STRING,
            description: "Subsystem name (e.g. 'MCU', 'Gyro Sensor')"
          },
          partsInvolved: {
            type: SchemaType.ARRAY,
            description: "BOM keys involved in this milestone",
            items: {
              type: SchemaType.STRING
            }
          },
          mcu: {
            type: SchemaType.STRING,
            description: "MCU name"
          },
          wiringSubset: {
            type: SchemaType.ARRAY,
            description: "Relevant wiring connections for this milestone step",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id: { type: SchemaType.STRING },
                from: { type: SchemaType.STRING },
                to: { type: SchemaType.STRING },
                net: { type: SchemaType.STRING },
                color: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING }
              },
              required: ["id", "from", "to"]
            }
          },
          previousMilestones: {
            type: SchemaType.ARRAY,
            description: "Titles of already completed milestones",
            items: {
              type: SchemaType.STRING
            }
          },
          isFirstMilestone: {
            type: SchemaType.BOOLEAN,
            description: "Force bare blink test if true"
          }
        },
        required: ["title", "objective", "subsystem", "partsInvolved", "mcu", "wiringSubset"]
      }
    },
    {
      name: "generate_diagram_json",
      description: "Generate a Wokwi diagram.json from the selected components and wiring connections. This is required for the simulation phase. Call after all milestones are generated.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          parts: {
            type: SchemaType.ARRAY,
            description: "List of simulated components",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                key: {
                  type: SchemaType.STRING,
                  description: "BOM key (e.g. 'mcu', 'gyro')"
                },
                wokwiPartType: {
                  type: SchemaType.STRING,
                  description: "Wokwi component type identifier"
                },
                id: {
                  type: SchemaType.STRING,
                  description: "Unique instance ID in simulation"
                }
              },
              required: ["key", "wokwiPartType", "id"]
            }
          },
          connections: {
            type: SchemaType.ARRAY,
            description: "Wiring connections from generate_wiring",
            items: {
              type: SchemaType.OBJECT,
              properties: {
                id: { type: SchemaType.STRING },
                from: { type: SchemaType.STRING },
                to: { type: SchemaType.STRING },
                net: { type: SchemaType.STRING },
                color: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING }
              },
              required: ["id", "from", "to"]
            }
          }
        },
        required: ["parts", "connections"]
      }
    },
    {
      name: "save_progress",
      description: "Save current progress to the database and notify the frontend. Call after BOM is finalized, after wiring is generated, and after each milestone is written. This ensures work is not lost and the UI updates in real time.",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          sessionId: {
            type: SchemaType.STRING,
            description: "Project session/database ID"
          },
          type: {
            type: SchemaType.STRING,
            description: "Type of data being saved",
            enum: ["bom", "wiring", "milestone", "diagram"]
          },
          data: {
            type: SchemaType.STRING,
            description: "The data payload as a serialized JSON string (required)"
          }
        },
        required: ["sessionId", "type", "data"]
      }
    }
  ]
};

export const GROQ_AGENT2_TOOLS = GEMINI_AGENT2_TOOLS.functionDeclarations.map((fd) => {
  // Convert SchemaType parameters to OpenAI/Groq function calling format
  const convertParameters = (params: any): any => {
    if (!params) return undefined;
    


    // Map SchemaType to corresponding string names
    const typeMapping: Record<any, string> = {
      [SchemaType.OBJECT]: "object",
      [SchemaType.STRING]: "string",
      [SchemaType.NUMBER]: "number",
      [SchemaType.ARRAY]: "array",
      [SchemaType.BOOLEAN]: "boolean"
    };

    const typeStr = typeMapping[params.type] || params.type;

    const newParams: any = {
      type: typeStr
    };

    if (params.description) newParams.description = params.description;
    if (params.enum) newParams.enum = params.enum;

    if (typeStr === "object" && params.properties) {
      newParams.properties = {};
      for (const [key, val] of Object.entries(params.properties)) {
        newParams.properties[key] = convertParameters(val);
      }
      if (params.required) {
        newParams.required = params.required;
      }
    } else if (typeStr === "array" && params.items) {
      newParams.items = convertParameters(params.items);
    }

    return newParams;
  };

  return {
    type: "function" as const,
    function: {
      name: fd.name,
      description: fd.description,
      parameters: convertParameters(fd.parameters)
    }
  };
});
