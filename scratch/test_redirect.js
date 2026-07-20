const axios = require('axios');

async function testRedirect() {
  try {
    // Let's use a URL that we know redirects, e.g., a google search or photos shortlink if we can find one.
    // Or we can just log how axios exposes the final URL.
    const url = "https://httpbin.org/redirect-to?url=https%3A%2F%2Fhttpbin.org%2Fjson&status_code=302";
    console.log("Fetching redirect URL:", url);
    const response = await axios.get(url);
    console.log("Response URL:", response.request.res.responseUrl);
    console.log("Data keys:", Object.keys(response.data));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testRedirect();
