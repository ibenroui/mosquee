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
        // Parse request body if available
        let body = {};
        if (event.body) {
            try {
                body = JSON.parse(event.body);
            } catch (e) {
                console.log("No valid JSON body, using defaults.");
            }
        }

        const mode = body.interval === 'month' ? 'subscription' : 'payment';
        const customAmount = body.amount; // Expecting amount in EUR (e.g., 100 for 100€)

        let lineItem;

        if (customAmount) {
            // Create a dynamic price on the fly for either payment or subscription
            const price = await stripe.prices.create({
                currency: 'eur',
                unit_amount: customAmount * 100, // Stripe expects cents
                ...(mode === 'subscription' && { recurring: { interval: 'month' } }),
                product: process.env.STRIPE_PRODUCT_ID || 'prod_S2Q0ozgEtfPWMX',
            });

            lineItem = {
                price: price.id,
                quantity: 1,
            };
        } else {
            // Fallback for old default one-time donation
            lineItem = {
                price: 'price_1R8LA5Bg3GJXa4BPRfnKLUdx',
                quantity: 1,
            };
        }

        // Define origin to handle return URL dynamically if possible, or fallback to hardcoded
        const origin = event.headers.origin || 'https://mosquee-annemasse.com/';

        const session = await stripe.checkout.sessions.create({
            ui_mode: 'embedded',
            line_items: [lineItem],
            mode: mode,
            return_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
        });

        console.log(`Session created: ${session.id} (mode: ${mode})`);

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
