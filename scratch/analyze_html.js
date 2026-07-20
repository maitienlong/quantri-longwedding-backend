const fs = require('fs');

const html = fs.readFileSync('scratch/photos_page.html', 'utf8');

// Search for any extension like .jpg or .JPG in the file
const searchExts = ['.jpg', '.JPG', '.jpeg', '.JPEG', '.png', '.PNG', '.heic', '.HEIC'];
for (let ext of searchExts) {
  let index = 0;
  let count = 0;
  while ((index = html.indexOf(ext, index)) !== -1) {
    count++;
    console.log(`Found extension ${ext} at index ${index}. Context: ${html.substring(index - 50, index + 50)}`);
    index += ext.length;
    if (count > 5) {
      console.log(`... and more for ${ext}`);
      break;
    }
  }
}
