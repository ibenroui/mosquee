import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
}
const stripe = new Stripe(stripeSecret.trim());

export const handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    try {
        let body = {};
        if (event.body) {
            body = JSON.parse(event.body);
        }

        const sessionId = body.session_id;

        if (!sessionId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Session ID is required.' }),
            };
        }

        // 1. Retrieve the Checkout Session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (!session.customer) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No customer associated with this session.' }),
            };
        }

        // Define origin to handle return URL dynamically if possible
        const origin = event.headers.origin || 'https://mosquee-annemasse.com/';

        // 2. Create Portal Session
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: session.customer,
            return_url: `${origin}/mensualites`,
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: portalSession.url }),
        };

    } catch (err) {
        console.error('Customer Portal Error:', err);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: err.message,
            }),
        };
    }
};
