const https = require('https');
const querystring = require('querystring');

// Keep HTTPS agent alive for better performance
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50
});

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { firstName, lastName, email, productType, quantity, successUrl, cancelUrl } = JSON.parse(event.body);

    // Validate required fields
    if (!firstName || !lastName || !email || !productType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields: firstName, lastName, email, and productType are required' 
        }),
      };
    }

    // Get price ID based on product type
    const priceIDs = {
      pdf: process.env.STRIPE_PRICE_ID_PDF,
      paperback: process.env.STRIPE_PRICE_ID_PAPERBACK
    };
    
    const stripePriceId = priceIDs[productType];
    
    if (!stripePriceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid product type or price not configured' 
        }),
      };
    }

    // Build Stripe API request data
    const sessionData = {
      'payment_method_types[]': 'card',
      'line_items[0][price]': stripePriceId,
      'line_items[0][quantity]': quantity || 1,
      'mode': 'payment',
      'success_url': successUrl || `${event.headers.origin || 'https://example.com'}/success?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': cancelUrl || `${event.headers.origin || 'https://example.com'}/cancel`,
      'customer_email': email,
      'metadata[firstName]': firstName,
      'metadata[lastName]': lastName,
      'metadata[email]': email,
      'metadata[productType]': productType,
      'metadata[quantity]': quantity || 1,
      'customer_creation': 'always',
      'billing_address_collection': 'auto',
    };

    // Add shipping for paperback orders
    if (productType === 'paperback') {
      sessionData['shipping_address_collection[allowed_countries][]'] = ['US', 'CA', 'GB'];
      
      // Add shipping rates if configured
      if (process.env.STRIPE_SHIPPING_RATE_GROUND_ADVANTAGE) {
        sessionData['shipping_options[0][shipping_rate]'] = process.env.STRIPE_SHIPPING_RATE_GROUND_ADVANTAGE;
      }
      if (process.env.STRIPE_SHIPPING_RATE_PRIORITY) {
        sessionData['shipping_options[1][shipping_rate]'] = process.env.STRIPE_SHIPPING_RATE_PRIORITY;
      }
      if (process.env.STRIPE_SHIPPING_RATE_PRIORITY_EXPRESS) {
        sessionData['shipping_options[2][shipping_rate]'] = process.env.STRIPE_SHIPPING_RATE_PRIORITY_EXPRESS;
      }
    }

    const postData = querystring.stringify(sessionData);

    // Make direct HTTPS request to Stripe API
    const stripeResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.stripe.com',
        port: 443,
        path: '/v1/checkout/sessions',
        method: 'POST',
        agent: httpsAgent,
        timeout: 25000, // 25 second timeout
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });

    if (stripeResponse.statusCode !== 200) {
      return {
        statusCode: stripeResponse.statusCode,
        headers,
        body: JSON.stringify({ 
          error: 'Stripe API error',
          message: stripeResponse.data.error?.message || 'Unknown error'
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        checkout_url: stripeResponse.data.url,
        session_id: stripeResponse.data.id,
      }),
    };

  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
    };
  }
};