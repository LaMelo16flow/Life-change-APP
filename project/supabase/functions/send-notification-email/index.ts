import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      console.log(`RESEND_API_KEY not found; email skipped for ${to} (development mode)`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email skipped - no API key configured',
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

    const emailBody = {
      from: 'LifeChangers <notifications@lifechangers.com>',
      to: [to],
      subject: subject,
      html: html,
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to send email: ${JSON.stringify(data)}`);
    }

    return new Response(
      JSON.stringify({ success: true, data }),
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
