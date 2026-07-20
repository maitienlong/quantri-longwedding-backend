const axios = require('axios');
const fs = require('fs');

async function inspectHtml(url) {
  try {
    console.log("Fetching URL:", url);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    console.log("HTML length:", html.length);
    fs.writeFileSync('scratch/photos_page.html', html, 'utf8');
    console.log("Saved raw HTML to scratch/photos_page.html");

    // Search for ".jpg" or ".JPG" or ".png" or ".heic" inside the HTML page
    // Let's do a regex search for any string that contains .jpg/.png etc.
    const regex1 = /"([^"\n]*\.(?:jpg|jpeg|png|heic|heif|gif|JPG|JPEG|PNG|HEIC|HEIF|GIF))"/g;
    const matches1 = [];
    let match;
    while ((match = regex1.exec(html)) !== null) {
      matches1.push(match[1]);
    }

    console.log(`Found ${matches1.length} matches for filename regex.`);
    console.log("Sample matches:");
    console.log(matches1.slice(0, 50));

    // Let's search if the text "DSC" or "IMG" or similar photographer-standard prefix is present
    const standardPrefixes = ['DSC', 'IMG', 'img', 'dsc'];
    for (let prefix of standardPrefixes) {
      const idx = html.indexOf(prefix);
      if (idx !== -1) {
        console.log(`Found prefix "${prefix}" at index ${idx}. Context: ${html.substring(idx - 20, idx + 40)}`);
      } else {
        console.log(`Prefix "${prefix}" not found.`);
      }
    }
  } catch (error) {
    console.error("Error inspecting:", error.message);
  }
}

// Use one of the links from the database
inspectHtml("https://photos.app.goo.gl/EZ21MSWkp7qC8h6t7");
