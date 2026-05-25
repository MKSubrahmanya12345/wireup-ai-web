import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../lib/db";
import { chatIdeationProject } from "../controllers/ideation.controller";

async function main() {
  await connectDB();

  // Mock Request
  const req = {
    body: {
      projectId: "6a13705c5fd52688b16a260c",
      message: "Start my project"
    },
    user: {
      _id: new mongoose.Types.ObjectId("69faf5827dd40bfe6c6b8562") // User mksubbu007
    }
  } as any;

  // Mock Response
  const res = {
    status: (code: number) => {
      console.log("--- RESPONSE STATUS:", code);
      return res;
    },
    json: (data: any) => {
      console.log("--- RESPONSE JSON:", JSON.stringify(data, null, 2));
      return res;
    }
  } as any;

  console.log("Executing chatIdeationProject...");
  try {
    await chatIdeationProject(req, res);
  } catch (err) {
    console.error("UNCAUGHT CONTROLLER ERROR:", err);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
