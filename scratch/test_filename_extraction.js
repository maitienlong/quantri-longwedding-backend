const mockHtml = `
AF_initDataCallback({
  key: 'ds:1',
  hash: '2',
  data: [
    ["id1", ["https://lh3.googleusercontent.com/pw/AM-JKqV8uY123", 100, 200], "IMG_1234.JPG"],
    ["id2", ["https://lh3.googleusercontent.com/pw/AM-JKqW9zZ098", 200, 300], "wedding_party.png"],
    ["id3", ["https://lh3.googleusercontent.com/pw/AM-JKqW9zZ099", 200, 300], "DSC_0987.HEIC"]
  ]
});
`;

function extractData(html) {
  // 1. Extract URLs
  const urlRegex = /https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9\-_]+/g;
  const urlMatches = html.match(urlRegex) || [];
  const uniqueUrls = [...new Set(urlMatches)];
  const photoUrls = uniqueUrls.filter(url => url.length > 50);

  // 2. Extract filenames
  // Match strings inside quotes that end with common image extensions and do not contain slashes
  const filenameRegex = /"([^"\/\\#\?]+\.(?:jpg|jpeg|png|heic|heif|gif|JPG|JPEG|PNG|HEIC|HEIF|GIF))"/g;
  const filenames = [];
  let match;
  while ((match = filenameRegex.exec(html)) !== null) {
    filenames.push(match[1]);
  }

  console.log("Extracted URLs:", photoUrls);
  console.log("Extracted Filenames:", filenames);

  const files = photoUrls.map((url, index) => {
    const name = filenames[index] || `Photo_${index + 1}.jpg`;
    return {
      id: url.split('/').pop(),
      name: name,
      urlGoc: `${url}=w2048-h2048`,
      urlNen: `${url}=w1000`
    };
  });

  return files;
}

const result = extractData(mockHtml);
console.log("Final combined files:", result);
if (result[0].name === "IMG_1234.JPG" && result[1].name === "wedding_party.png" && result[2].name === "DSC_0987.HEIC") {
  console.log("TEST PASSED!");
} else {
  console.log("TEST FAILED!");
}
