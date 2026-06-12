// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// ??$$$ newer code — Extended Part Schema for Ingestion Pipeline
import mongoose, { Document, Schema } from "mongoose";

// ??$$$ NEW FLOW — SnapEDA/EasyEDA pin metadata type
export interface IPartPin {
  id: string;
  name: string;
  type: string;
  compatibleWith?: string[];
  
  // Backward compatibility fields (SnapEDA pin coordinates)
  x_mm?: number;
  y_mm?: number;
  z_mm?: number;

  // Coordinate spaces
  pcbPosition?: {
    x_mm: number;
    y_mm: number;
  };
  modelPosition?: {
    x: number;
    y: number;
    z: number;
  };
  worldPosition?: {
    x: number;
    y: number;
    z: number;
  };

  rotation?: {
    x: number;
    y: number;
    z: number;
  };
  normal?: {
    x: number;
    y: number;
    z: number;
  };
  snapRadius?: number;
}

export interface IPart extends Document {
  mpn: string;
  name: string;
  manufacturer: string;
  description: string;
  imageUrl?: string;
  datasheetUrl?: string;
  specs?: any;
  available?: number;
  price?: number;
  category?: string;
  wokwiPartType?: string;
  isCurated?: boolean;
  glbUrl?: string;
  snapedaId?: string;
  // ??$$$ newer code
  componentType?: string;
  
  // Canonical metadata fields
  componentFormatVersion?: string;
  source?: string;
  sourceId?: string;
  assetVersion?: number;
  pipelineVersion?: string;

  // Package metadata
  package?: {
    type: string;
    pitch_mm: number;
    mounting: string;
  };

  // Mesh metrics & Separated transforms
  mesh?: {
    vertices: number;
    materials: number;
    optimized: boolean;
  };

  transform?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };

  pins?: IPartPin[];
  pinsCachedAt?: Date;
  footprint?: any;
  symbol?: any;
  
  createdAt: Date;
  updatedAt: Date;
}


// ??$$$ Extended Part Schema with ingestion fields
const partSchema = new Schema<IPart>(
  {
    mpn: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    manufacturer: { type: String, required: true },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    datasheetUrl: { type: String, default: "" },
    specs: { type: Schema.Types.Mixed, default: {} },
    available: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    category: { type: String, default: "" },
    wokwiPartType: { type: String, default: "" },
    // ??$$$ newer code
    componentType: {
      type: String,
      enum: ["microcontroller", "led", "button", "display", "sensor", "motor", "module"],
      default: "module"
    },
    isCurated: { type: Boolean, default: true },
    glbUrl: { type: String, default: "" },
    snapedaId: { type: String, default: "" },
    
    // Canonical formats
    componentFormatVersion: { type: String, default: "1.0" },
    source: { type: String, default: "easyeda" },
    sourceId: { type: String, default: "" },
    assetVersion: { type: Number, default: 1 },
    pipelineVersion: { type: String, default: "1.0.0" },

    // Package details
    package: {
      type: {
        type: String,
        default: ""
      },
      pitch_mm: { type: Number, default: 0 },
      mounting: { type: String, default: "smd" }
    },

    // Mesh metadata & separated transforms
    mesh: {
      vertices: { type: Number, default: 0 },
      materials: { type: Number, default: 0 },
      optimized: { type: Boolean, default: false }
    },

    transform: {
      position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        z: { type: Number, default: 0 }
      },
      rotation: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        z: { type: Number, default: 0 }
      },
      scale: {
        x: { type: Number, default: 1 },
        y: { type: Number, default: 1 },
        z: { type: Number, default: 1 }
      }
    },

    pins: {
      type: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, default: "digital" },
        compatibleWith: { type: [String], default: [] },
        
        // Backward compatibility
        x_mm: { type: Number, default: 0 },
        y_mm: { type: Number, default: 0 },
        z_mm: { type: Number, default: 0 },

        // Coordinate spaces
        pcbPosition: {
          x_mm: { type: Number, default: 0 },
          y_mm: { type: Number, default: 0 }
        },
        modelPosition: {
          x: { type: Number, default: 0 },
          y: { type: Number, default: 0 },
          z: { type: Number, default: 0 }
        },
        worldPosition: {
          x: { type: Number, default: 0 },
          y: { type: Number, default: 0 },
          z: { type: Number, default: 0 }
        },

        rotation: {
          x: { type: Number, default: 0 },
          y: { type: Number, default: 0 },
          z: { type: Number, default: 0 }
        },
        normal: {
          x: { type: Number, default: 0 },
          y: { type: Number, default: 0 },
          z: { type: Number, default: 1 }
        },
        snapRadius: { type: Number, default: 2.0 }
      }],
      default: []
    },
    pinsCachedAt: { type: Date, default: null },
    footprint: { type: Schema.Types.Mixed, default: null },
    symbol: { type: Schema.Types.Mixed, default: null }
  },
  {
    timestamps: true
  }
);

// ??$$$ text index on key fields for local search
partSchema.index({
  mpn: "text",
  name: "text",
  description: "text",
  manufacturer: "text",
  category: "text"
});

const Part = mongoose.models.Part || mongoose.model<IPart>("Part", partSchema);
export default Part;
