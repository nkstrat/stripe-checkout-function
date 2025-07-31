const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
    // Parse the request body
    const { firstName, lastName, email, priceId, successUrl, cancelUrl } = JSON.parse(event.body);

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields: firstName, lastName, and email are required' 
        }),
      };
    }

    // Use provided priceId or fallback to environment variable
    const stripePriceId = priceId || process.env.STRIPE_PRICE_ID;
    
    if (!stripePriceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'No price ID provided' 
        }),
      };
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || `${event.headers.origin || 'https://example.com'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${event.headers.origin || 'https://example.com'}/cancel`,
      customer_email: email,
      metadata: {
        firstName: firstName,
        lastName: lastName,
        email: email,
        // Add any additional custom fields here
      },
      // Optional: Collect additional customer information
      customer_creation: 'always',
      billing_address_collection: 'auto',
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        checkout_url: session.url,
        session_id: session.id,
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