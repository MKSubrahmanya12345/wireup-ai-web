const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backend/src/services/ai.services.ts');
let content = fs.readFileSync(filePath, 'utf8');

const marker = '/* commented out legacy implementation below';
const markerIndex = content.indexOf(marker);

if (markerIndex !== -1) {
  const prefix = content.substring(0, markerIndex + marker.length);
  let rest = content.substring(markerIndex + marker.length);
  
  // Find the last closing comment marker
  const lastIndex = rest.lastIndexOf('*/');
  if (lastIndex !== -1) {
    const legacyCode = rest.substring(0, lastIndex);
    const suffix = rest.substring(lastIndex);
    
    // Replace all nested */ with * /
    const escapedLegacy = legacyCode.replace(/\*\//g, '* /');
    
    content = prefix + escapedLegacy + suffix;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully escaped nested comments in ai.services.ts');
  } else {
    console.log('Could not find ending comment marker');
  }
} else {
  console.log('Could not find marker in ai.services.ts');
}
