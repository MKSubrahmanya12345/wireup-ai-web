import Groq from "groq-sdk";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error("No GROQ_API_KEY found!");
  process.exit(1);
}

const groq = new Groq({ apiKey });

async function testModel(modelName: string) {
  try {
    console.log(`Testing model: ${modelName}`);
    const res = await groq.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 10
    });
    console.log(`✅ Success for ${modelName}:`, res.choices[0]?.message?.content);
  } catch (err: any) {
    console.log(`❌ Failed for ${modelName}:`, err.message);
  }
}

async function main() {
  await testModel("qwen-2.5-32b");
  await testModel("qwen/qwen-2.5-32b");
  await testModel("qwen/qwen3-32b");
}

main();
