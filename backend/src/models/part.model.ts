// ??$$$ newer code
import mongoose, { Document, Schema } from "mongoose";

// ??$$$ NEW FLOW — SnapEDA pin metadata type
export interface IPartPin {
  id: string;
  name: string;
  x_mm: number;
  y_mm: number;
  z_mm: number;
  type: "power" | "digital" | "analog" | "gnd" | "nc";
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
  // ??$$$ NEW FLOW — SnapEDA pin metadata
  snapedaId?: string;
  pins?: IPartPin[];
  pinsCachedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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
    isCurated: { type: Boolean, default: true },
    glbUrl: { type: String, default: "" },
    // ??$$$ NEW FLOW — SnapEDA pin metadata
    snapedaId: { type: String, default: "" },
    pins: {
      type: [{
        id: { type: String, required: true },
        name: { type: String, required: true },
        x_mm: { type: Number, default: 0 },
        y_mm: { type: Number, default: 0 },
        z_mm: { type: Number, default: 0 },
        type: { type: String, default: "digital" }
      }],
      default: []
    },
    pinsCachedAt: { type: Date, default: null }
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
