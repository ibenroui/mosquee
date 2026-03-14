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
        console.log('Creating Stripe session...');
        const session = await stripe.checkout.sessions.create({
            ui_mode: 'embedded',
            line_items: [
                {
                    price: 'price_1R8LA5Bg3GJXa4BPRfnKLUdx',
                    quantity: 1,
                },
            ],
            mode: 'payment',
            return_url: `https://precious-madeleine-a1ed57.netlify.app/?session_id={CHECKOUT_SESSION_ID}`,
        });
        console.log('Session created:', session.id);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ clientSecret: session.client_secret }),
        };
    } catch (err) {
        console.error('Stripe Checkout Error Full:', err);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: err.message,
                type: err.type,
                code: err.code
            }),
        };
    }
};
