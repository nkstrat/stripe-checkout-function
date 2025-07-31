# Stripe Checkout Netlify Function

A serverless function for processing Stripe checkout with custom fields, designed to integrate with Squarespace forms.

## Setup Instructions

### 1. Local Development

```bash
# Navigate to project directory
cd stripe-checkout-function

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your Stripe keys
# Get these from https://dashboard.stripe.com/test/apikeys
```

### 2. Environment Variables

Add these to your `.env` file:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID=price_...
```

### 3. Local Testing

```bash
# Install Netlify CLI globally if not already installed
npm install -g netlify-cli

# Run locally
netlify dev
```

The function will be available at: `http://localhost:8888/.netlify/functions/create-checkout`

### 4. Netlify Deployment

1. Push this repository to GitHub
2. Connect your GitHub repo to Netlify
3. Set environment variables in Netlify dashboard (Site settings → Environment variables)
4. Deploy

### 5. Squarespace Integration

1. Copy the HTML/JavaScript code from `public/squarespace-form.html`
2. Add it to a Code Block in your Squarespace page
3. Update the Netlify function URL in the JavaScript
4. Configure success/cancel URLs to match your Squarespace pages

## Function Details

### Endpoint
`POST /.netlify/functions/create-checkout`

### Request Body
```json
{
  "firstName": "John",
  "lastName": "Doe", 
  "email": "john@example.com",
  "priceId": "price_optional_override",
  "successUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel"
}
```

### Response
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_..."
}
```

## Custom Fields

Custom fields (firstName, lastName) are stored in Stripe's metadata field and can be accessed via:
- Stripe Dashboard
- Webhooks
- Stripe API

## Security Features

- CORS headers for cross-origin requests
- Input validation
- Environment variable protection
- Error handling

## Next Steps

1. Set up Stripe webhooks for order fulfillment
2. Add additional custom fields as needed
3. Customize email confirmations
4. Set up product variants (different price IDs)