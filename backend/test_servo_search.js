// ??$$$ non-important
const { searchEasyEdaComponents, fetchEasyEdaComponent } = require('./src/services/easyeda.service');

async function test() {
  try {
    console.log("Searching for 'servo'...");
    const results = await searchEasyEdaComponents("servo");
    console.log(`Found ${results.length} search results.`);
    
    for (let i = 0; i < Math.min(5, results.length); i++) {
      const item = results[i];
      console.log(`\nResult ${i + 1}:`);
      console.log(`- Title: ${item.title}`);
      console.log(`- MPN: ${item.mpn}`);
      console.log(`- UUID: ${item.uuid}`);
      
      const detail = await fetchEasyEdaComponent(item.mpn, item.lcsc);
      if (detail) {
        console.log(`- Detail MPN: ${detail.mpn}`);
        console.log(`- 3dmodel UUID:`, detail.model3d);
      } else {
        console.log(`- Failed to fetch detail.`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}
test();
