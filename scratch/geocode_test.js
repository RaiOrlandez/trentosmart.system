const https = require('https');

const queries = [
  'Landbank, Trento',
  'Jollibee, Trento',
  'Mercury Drug, Trento'
];

function geocode(query) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const options = {
      headers: {
        'User-Agent': 'TrentoSmartGeocodeScript/3.0'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.length > 0) {
            resolve({
              query,
              lat: parseFloat(json[0].lat),
              lon: parseFloat(json[0].lon),
              display_name: json[0].display_name
            });
          } else {
            resolve({ query, error: 'Not found' });
          }
        } catch (e) {
          resolve({ query, error: e.message });
        }
      });
    }).on('error', (err) => {
      resolve({ query, error: err.message });
    });
  });
}

async function run() {
  console.log("Searching commercial...");
  for (const q of queries) {
    const result = await geocode(q);
    console.log(JSON.stringify(result, null, 2));
    await new Promise(r => setTimeout(r, 1500));
  }
}

run();
