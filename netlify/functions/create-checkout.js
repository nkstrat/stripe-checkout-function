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
          error: 'No price ID provided' 
        }),
      };
    }

    // Create checkout session options
    const sessionOptions = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: quantity || 1,
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
        productType: productType,
        quantity: quantity || 1,
      },
      customer_creation: 'always',
      billing_address_collection: 'auto',
    };

    // Add shipping for paperback orders
    if (productType === 'paperback') {
      sessionOptions.shipping_address_collection = {
        allowed_countries: ['US', 'CA', 'GB'],
      };
      // Include specific shipping rates (replace with your actual shipping rate IDs)
      sessionOptions.shipping_options = [
        {
          shipping_rate: process.env.STRIPE_SHIPPING_RATE_STANDARD || 'shr_your_standard_rate_id',
        },
        {
          shipping_rate: process.env.STRIPE_SHIPPING_RATE_EXPRESS || 'shr_your_express_rate_id',
        },
      ];
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionOptions);

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