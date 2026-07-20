const axios = require('axios');

// Mock HTML that represents a Google Photos shared album page
const mockHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Photos Shared Album Mock</title>
</head>
<body>
  <div>Some content here</div>
  <script>
    // Mock user contents URLs inside Google Photos
    const images = [
      "https://lh3.googleusercontent.com/pw/AM-JKqV8uY1234567890abcdefghijklmnopqr",
      "https://lh3.googleusercontent.com/pw/AM-JKqV8uY1234567890abcdefghijklmnopqr", // duplicate
      "https://lh3.googleusercontent.com/pw/AM-JKqW9zZ0987654321zyxwvutsrqponmlkjihg",
      "https://lh3.googleusercontent.com/pw/short", // filtered due to length < 50
    ];
  </script>
</body>
</html>
`;

// Logic copied from updated processImagesInBackground
function parseHtml(html) {
  const regex = /https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9\-_]+/g;
  const matches = html.match(regex) || [];
  const uniqueUrls = [...new Set(matches)];
  const photoUrls = uniqueUrls.filter(url => url.length > 50);

  const files = photoUrls.map((url, index) => ({
    id: url.split('/').pop(),
    name: `Photo_${index + 1}.jpg`,
    urlGoc: `${url}=w2048-h2048`,
    urlNen: `${url}=w1000`
  }));
  return files;
}

const results = parseHtml(mockHtml);
console.log("Mock parsed results:", results);
if (results.length === 2 && 
    results[0].id === "AM-JKqV8uY1234567890abcdefghijklmnopqr" && 
    results[0].urlGoc === "https://lh3.googleusercontent.com/pw/AM-JKqV8uY1234567890abcdefghijklmnopqr=w2048-h2048" &&
    results[0].urlNen === "https://lh3.googleusercontent.com/pw/AM-JKqV8uY1234567890abcdefghijklmnopqr=w1000" &&
    results[1].id === "AM-JKqW9zZ0987654321zyxwvutsrqponmlkjihg") {
  console.log("TEST PASSED!");
} else {
  console.log("TEST FAILED!");
}
