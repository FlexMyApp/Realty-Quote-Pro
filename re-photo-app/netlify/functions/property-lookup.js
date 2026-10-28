exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.PROPRAVEN_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'PROPRAVEN_API_KEY not set' })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { address, city, state, zip } = body;

    if (!address) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Address is required' })
      };
    }

    const query = [address, city, state, zip].filter(Boolean).join(', ');
    const url = `https://propraven.com/api/v1/search/full?q=${encodeURIComponent(query)}&limit=5`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};