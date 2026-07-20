const axios = require('axios');

async function testGPhotos(url) {
  try {
    console.log("Fetching URL:", url);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    console.log("HTML length:", html.length);

    // Try to find lh3.googleusercontent.com links
    // In google photos, they are usually in the form: https://lh3.googleusercontent.com/pw/xxxx or similar
    const regex = /https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9\-_]+/g;
    const matches = html.match(regex);
    
    if (!matches) {
      console.log("No lh3.googleusercontent.com/pw/ links found.");
      // Let's search for any lh3.googleusercontent.com
      const regexAll = /https:\/\/lh3\.googleusercontent\.com\/[a-zA-Z0-9\-_]+/g;
      const matchesAll = html.match(regexAll);
      if (matchesAll) {
        console.log(`Found ${matchesAll.length} general lh3 links.`);
        const unique = [...new Set(matchesAll)];
        console.log(`Unique matches (${unique.length}):`);
        console.log(unique.slice(0, 10));
      } else {
        console.log("No lh3.googleusercontent.com links found at all.");
      }
    } else {
      const unique = [...new Set(matches)];
      console.log(`Found ${matches.length} pw matches. Unique: ${unique.length}`);
      console.log(unique.slice(0, 10));
    }
  } catch (error) {
    console.error("Error fetching:", error.message);
  }
}

// A sample public google photos shared album for testing
const testUrl = "https://photos.app.goo.gl/d2S4hA7z3iA9c7qT7"; // Example/placeholder, or we can use another one
testGPhotos(testUrl);
