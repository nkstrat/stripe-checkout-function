const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { firstName, lastName, email, productType, quantity, successUrl, cancelUrl } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !productType) {
      return res.status(400).json({ 
        error: 'Missing required fields: firstName, lastName, email, and productType are required' 
      });
    }

    // Get price ID based on product type
    const priceIDs = {
      pdf: process.env.STRIPE_PRICE_ID_PDF,
      paperback: process.env.STRIPE_PRICE_ID_PAPERBACK
    };
    
    const stripePriceId = priceIDs[productType];
    
    if (!stripePriceId) {
      return res.status(400).json({ 
        error: 'Invalid product type or price not configured' 
      });
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
      success_url: successUrl || `${req.headers.origin || 'https://example.com'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin || 'https://example.com'}/cancel`,
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
      // Include USPS shipping rates
      sessionOptions.shipping_options = [
        {
          shipping_rate: process.env.STRIPE_SHIPPING_RATE_GROUND_ADVANTAGE,
        },
        {
          shipping_rate: process.env.STRIPE_SHIPPING_RATE_PRIORITY,
        },
        {
          shipping_rate: process.env.STRIPE_SHIPPING_RATE_PRIORITY_EXPRESS,
        },
      ];
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionOptions);

    return res.status(200).json({
      checkout_url: session.url,
      session_id: session.id,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}