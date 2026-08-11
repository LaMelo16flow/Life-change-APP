import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { isGmailConfigured, sendGmailEmail } from "../_shared/sendGmailEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  type: 'order_placed' | 'order_approved' | 'payment_submitted' | 'payment_verified' | 'order_rejected' | 'account_approval_request' | 'promotion_created';
  orderData?: {
    orderNumber: string;
    productName: string;
    quantity: number;
    totalAmount: string;
    userName: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const emailRequest: EmailRequest = await req.json();
    const { to, subject, html, type } = emailRequest;

    if (!to || !to.includes('@')) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email skipped - no valid recipient email',
          development: true
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!isGmailConfigured()) {
      console.log(`Gmail credentials not configured; email skipped for ${to} (development mode)`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email skipped - Gmail not configured',
          development: true,
          recipient: to,
          type,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    await sendGmailEmail({ to, subject, html });

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
