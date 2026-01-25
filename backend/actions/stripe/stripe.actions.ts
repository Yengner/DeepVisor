'use server';

import { formatStripeTimestamp } from '@/lib/utils/date';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-05-28.basil',
});

const PLAN_PRICE_IDS = {
    TIER1: process.env.STRIPE_PRICE_ID_TIER1!,
    TIER2: process.env.STRIPE_PRICE_ID_TIER2!,
    TIER3: process.env.STRIPE_PRICE_ID_TIER3!,
};

export async function createCheckoutSession(planCode: string) {
    try {
        const supabase = await createSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error('User not authenticated');
        }

        if (!PLAN_PRICE_IDS[planCode as keyof typeof PLAN_PRICE_IDS]) {
            throw new Error('Invalid plan selected');
        }

        // Create a Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            customer_email: user.email,
            client_reference_id: user.id,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: PLAN_PRICE_IDS[planCode as keyof typeof PLAN_PRICE_IDS],
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/select-plan?canceled=true`,
            allow_promotion_codes: true,
            metadata: {
                userId: user.id,
                planCode: planCode,
            },
        });

        if (!session || !session.url) {
            throw new Error('Failed to create checkout session');
        }

        return { url: session.url };
    } catch (error) {
        console.error('Error creating checkout session:', error);
        throw error;
    }
}

export async function verifyPaymentAndStoreSubscription(sessionId: string) {
    try {
        const supabase = await createSupabaseClient();

        // Retrieve session from Stripe to verify payment
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (!session || session.payment_status !== 'paid') {
            return { success: false, error: 'Payment verification failed' };
        }

        const userId = session.client_reference_id;
        const planCode = session.metadata?.planCode;
        const subscriptionId = session.subscription as string;

        if (!userId || !planCode || !subscriptionId) {
            return { success: false, error: 'Missing subscription information' };
        }

        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const invoice = await stripe.invoices.retrieve(subscription.latest_invoice as string);

        // Use the invoice period values directly
        const startDateFormatted = formatStripeTimestamp(invoice.period_start);
        const endDateFormatted = formatStripeTimestamp(invoice.period_end);

        // Update user profile in Supabase
        const { error } = await supabase
            .from('profiles')
            .update({
                subscription_status: subscription.status,
                plan_tier: planCode,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscriptionId,
                subscription_start_date: startDateFormatted?.iso,
                subscription_end_date: endDateFormatted?.iso,
                subscription_created: formatStripeTimestamp(subscription.created)?.iso,
                invoice_url: invoice.hosted_invoice_url || null,
                invoice_pdf_url: invoice.invoice_pdf || null,
                last_payment_amount: invoice.amount_paid / 100,
                last_payment_date: formatStripeTimestamp(invoice.created)?.iso,
            })
            .eq('id', userId);

        if (error) {
            console.error('Error updating profile with subscription data:', error);
            return { success: false, error: 'Failed to update subscription information' };
        }

        // Store payment session for reference
        const { error: sessionError } = await supabase
            .from('payment_sessions')
            .insert({
                user_id: userId,
                session_id: sessionId,
                amount_total: session.amount_total,
                subscription_id: subscriptionId,
                plan_code: planCode,
                payment_status: session.payment_status,
                created_at: new Date().toISOString()
            });

        if (sessionError) {
            console.error('Error storing payment session:', sessionError);
        }

        return { success: true };
    } catch (error) {
        console.error('Error verifying payment:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
}