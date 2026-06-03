// ??$$$ non-important
// ??$$$ newer code
import mongoose from "mongoose";
import "dotenv/config";
import process from "process";
import { connectDB } from "../lib/db";
import Project from "../models/project.model";
import { getProjectThinking } from "../controllers/ideation.controller";

async function runTest() {
  console.log("🚀 Starting Live Thinking Verification Tests...\n");
  await connectDB();

  // Find any project in the DB to test with
  const project = await Project.findOne();
  if (!project) {
    console.error("❌ No project found in the database. Please create a project first.");
    process.exit(1);
  }

  console.log(`Using Project ID: ${project._id}`);

  // Save a mock live thinking log (JSON array of segments)
  const mockSegments = [
    {
      type: "tool_call",
      name: "search_library",
      status: "Done",
      input: {
        LIMIT: 5,
        QUERY: "FLIGHT CONTROLLER F4 MINI QUADCOPTER",
        STRATEGY: "AUTO"
      },
      output: {
        FALLBACKUSED: false,
        RESULTS: [
          {
            NAME: "MICOAIR 743 FC/ESC STACK",
            DOCID: "KHCR00MHFHIFOUQZXDLY"
          }
        ]
      }
    }
  ];
  
  const mockThinkingLog = JSON.stringify(mockSegments);

  await Project.findByIdAndUpdate(project._id, {
    $set: { "ideation.thinking": mockThinkingLog }
  });

  console.log("Mock thinking log successfully written to DB.");

  // Test the controller method with mock req and res
  const mockReq = {
    params: { projectId: project._id.toString() },
    user: { _id: project.owner } // simulate owner validation
  } as any;

  let responseData: any = null;
  const mockRes = {
    status: (code: number) => {
      console.log(`Mock Response Status: ${code}`);
      return mockRes;
    },
    json: (data: any) => {
      responseData = data;
      return mockRes;
    }
  } as any;

  await getProjectThinking(mockReq, mockRes);

  console.log("Response from getProjectThinking controller:");
  console.log(JSON.stringify(responseData, null, 2));

  if (responseData && responseData.thinking === mockThinkingLog) {
    console.log("🎉 Test Passed! Polling endpoint returns correct live thinking logs.");
  } else {
    console.error("❌ Test Failed! Returned thinking logs do not match.");
  }

  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
