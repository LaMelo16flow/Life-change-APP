import { supabase } from '../lib/supabase';

export interface OrderNotificationData {
  orderNumber: string;
  productName: string;
  quantity: number;
  totalAmount: string;
  userName: string;
  userEmail?: string;
  adminEmail?: string;
}

export async function sendAccountApprovalRequestNotification(userData: {
  fullName: string;
  email: string;
  countryCode: string;
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #2563eb; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">New Account Approval Request</h2>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          A new user has registered and is waiting for account approval.
        </p>
        <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <p style="margin: 0 0 8px 0; color: #1e40af;"><strong>New User Details</strong></p>
          <p style="margin: 4px 0; color: #1e3a5f;">Name: ${userData.fullName}</p>
          <p style="margin: 4px 0; color: #1e3a5f;">Email: ${userData.email}</p>
          <p style="margin: 4px 0; color: #1e3a5f;">Country: ${userData.countryCode}</p>
        </div>
        <p style="color: #374151; font-size: 14px;">
          Please log in to the admin dashboard to review and approve or reject this account.
        </p>
        <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
          This is an automated notification from the LifeChangers platform.
        </p>
      </div>
    </div>
  `;

  await createInAppNotification({
    type: 'approval',
    title: 'New Account Approval Request',
    message: `${userData.fullName} (${userData.email}) has registered and is waiting for approval.`,
    action_url: '/admin/accounts',
    userRole: 'admin_and_managers',
  });

  const { data: recipients } = await supabase
    .from('profiles')
    .select('email')
    .or('role.eq.manager,is_master.eq.true');

  if (recipients && recipients.length > 0) {
    const emailPromises = recipients
      .filter((r) => r.email)
      .map((r) =>
        sendEmail({
          to: r.email,
          subject: `New Account Approval Request: ${userData.fullName}`,
          html,
          type: 'account_approval_request',
        })
      );
    await Promise.allSettled(emailPromises);
  }
}

export async function sendOrderPlacedNotification(orderData: OrderNotificationData) {
  const adminSettings = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'admin_contact_email')
    .maybeSingle();

  const adminEmail = adminSettings?.data?.value?.email || 'admin@lifechangers.com';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">New Order Placed</h2>
      <p>A new order has been placed and requires your approval.</p>

      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Order Details</h3>
        <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
        <p><strong>Customer:</strong> ${orderData.userName} (${orderData.userEmail})</p>
        <p><strong>Product:</strong> ${orderData.productName}</p>
        <p><strong>Quantity:</strong> ${orderData.quantity}</p>
        <p><strong>Total Amount:</strong> ${orderData.totalAmount}</p>
      </div>

      <p>Please log in to the admin dashboard to review and approve this order.</p>

      <a href="${window.location.origin}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
        View Order in Dashboard
      </a>
    </div>
  `;

  await sendEmail({
    to: adminEmail,
    subject: `New Order #${orderData.orderNumber} - Action Required`,
    html,
    type: 'order_placed',
    orderData,
  });

  await createInAppNotification({
    type: 'approval',
    title: 'New Order Placed',
    message: `Order #${orderData.orderNumber} from ${orderData.userName} requires approval`,
    action_url: '/admin/orders',
    userRole: 'admin',
  });
}

export async function sendOrderApprovedNotification(orderData: OrderNotificationData, userEmail: string, userId?: string) {
  const paymentInstructions = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'payment_instructions')
    .maybeSingle();

  const instructions = paymentInstructions?.data?.value?.instructions ||
    'Please send e-transfer to the admin email provided. Include your order number in the message.';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #10b981; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">Order Approved!</h2>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Great news! Your order has been approved.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">Order Details</h3>
          <p style="margin: 8px 0; color: #374151;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
          <p style="margin: 8px 0; color: #374151;"><strong>Product:</strong> ${orderData.productName}</p>
          <p style="margin: 8px 0; color: #374151;"><strong>Quantity:</strong> ${orderData.quantity}</p>
          <p style="margin: 8px 0; color: #374151;"><strong>Total Amount:</strong> ${orderData.totalAmount}</p>
        </div>

        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h3 style="margin-top: 0; color: #92400e;">Payment Instructions</h3>
          <p style="margin: 10px 0; color: #78350f;">${instructions}</p>
          <p style="margin: 10px 0; color: #78350f;"><strong>Admin Email:</strong> ${orderData.adminEmail}</p>
          <p style="margin: 10px 0; color: #78350f;"><strong>Reference:</strong> Order #${orderData.orderNumber}</p>
        </div>

        <p style="color: #374151;"><strong>Next Steps:</strong></p>
        <ol style="color: #374151; line-height: 1.8;">
          <li>Send your e-transfer to the admin email address above</li>
          <li>Include your order number (${orderData.orderNumber}) in the transfer message</li>
          <li>Take a screenshot of the transfer confirmation</li>
          <li>Upload the screenshot in your order dashboard</li>
        </ol>

        <a href="${window.location.origin}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px; font-weight: 600;">
          Upload Payment Proof
        </a>

        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          This is an automated notification from the LifeChangers platform.
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: userEmail,
    subject: `Order #${orderData.orderNumber} Approved - Payment Required`,
    html,
    type: 'order_approved',
    orderData,
  });

  if (userId) {
    await createInAppNotification({
      type: 'payment',
      title: 'Order Approved - Payment Required',
      message: `Your order #${orderData.orderNumber} has been approved. Please submit payment.`,
      action_url: '/orders',
      userId,
    });
  }
}

export async function sendPaymentSubmittedNotification(orderData: OrderNotificationData, adminEmail: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Payment Proof Submitted</h2>
      <p>A customer has submitted payment proof for their order.</p>

      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Order Details</h3>
        <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
        <p><strong>Customer:</strong> ${orderData.userName} (${orderData.userEmail})</p>
        <p><strong>Product:</strong> ${orderData.productName}</p>
        <p><strong>Total Amount:</strong> ${orderData.totalAmount}</p>
      </div>

      <p>Please review the payment proof and verify the payment in the admin dashboard.</p>

      <a href="${window.location.origin}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
        Verify Payment
      </a>
    </div>
  `;

  await sendEmail({
    to: adminEmail,
    subject: `Payment Proof Submitted - Order #${orderData.orderNumber}`,
    html,
    type: 'payment_submitted',
    orderData,
  });

  await createInAppNotification({
    type: 'payment',
    title: 'Payment Proof Submitted',
    message: `Order #${orderData.orderNumber} - ${orderData.userName} submitted payment proof`,
    action_url: '/admin/orders',
    userRole: 'admin',
  });
}

export async function sendPaymentVerifiedNotification(orderData: OrderNotificationData, userEmail: string, userId?: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #10b981; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">Payment Verified - Order Complete!</h2>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Congratulations! Your payment has been verified and your order is now complete.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">Order Details</h3>
          <p style="margin: 8px 0; color: #374151;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
          <p style="margin: 8px 0; color: #374151;"><strong>Product:</strong> ${orderData.productName}</p>
          <p style="margin: 8px 0; color: #374151;"><strong>Quantity:</strong> ${orderData.quantity}</p>
          <p style="margin: 8px 0; color: #374151;"><strong>Total Amount:</strong> ${orderData.totalAmount}</p>
        </div>

        <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="margin: 0; color: #065f46; font-size: 16px;"><strong>Your order is complete!</strong></p>
          <p style="margin: 10px 0 0 0; color: #065f46;">Your PV points have been added to your account.</p>
        </div>

        <p style="color: #374151;">Thank you for your purchase!</p>

        <a href="${window.location.origin}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px; font-weight: 600;">
          View Dashboard
        </a>

        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          This is an automated notification from the LifeChangers platform.
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: userEmail,
    subject: `Order #${orderData.orderNumber} Complete - Payment Verified`,
    html,
    type: 'payment_verified',
    orderData,
  });

  if (userId) {
    await createInAppNotification({
      type: 'payment',
      title: 'Payment Verified - Order Complete!',
      message: `Your payment for order #${orderData.orderNumber} has been verified. PV points added to your account.`,
      action_url: '/orders',
      userId,
    });
  }
}

export async function sendRankPromotionRequestNotification(userData: {
  userId: string;
  userName: string;
  fromRank: string;
  toRank: string;
}) {
  await createInAppNotification({
    type: 'promotion',
    title: 'New Rank Promotion Request',
    message: `${userData.userName} has requested promotion from ${userData.fromRank} to ${userData.toRank}`,
    action_url: '/admin/promotions',
    userRole: 'admin_and_managers',
  });
}

export async function sendRankPromotionApprovedNotification(userData: {
  userId: string;
  userName: string;
  userEmail: string;
  newRank: string;
  previousRank?: string;
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #10b981; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">Congratulations on Your Promotion!</h2>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          Dear ${userData.userName},
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          We are thrilled to announce that your rank promotion request has been approved!
        </p>

        <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; text-align: center;">
          <p style="margin: 0; color: #065f46; font-size: 14px;">Your New Rank</p>
          <p style="margin: 10px 0 0 0; color: #065f46; font-size: 24px; font-weight: bold;">${userData.newRank}</p>
          ${userData.previousRank ? `<p style="margin: 8px 0 0 0; color: #047857; font-size: 13px;">Previously: ${userData.previousRank}</p>` : ''}
        </div>

        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          This achievement reflects your hard work and dedication. Keep up the excellent work!
        </p>

        <a href="${window.location.origin}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px; font-weight: 600;">
          View Your Dashboard
        </a>

        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          This is an automated notification from the LifeChangers platform.
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: userData.userEmail,
    subject: `Congratulations! You've been promoted to ${userData.newRank}`,
    html,
    type: 'rank_promotion_approved',
  });

  await createInAppNotification({
    type: 'promotion',
    title: 'Rank Promotion Approved!',
    message: `Congratulations! You have been promoted to ${userData.newRank}`,
    action_url: '/rank',
    userId: userData.userId,
  });
}

export async function sendRankPromotionRejectedNotification(userData: {
  userId: string;
  userName: string;
  userEmail: string;
  rank: string;
  reason?: string;
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f59e0b; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">Rank Promotion Request Update</h2>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          Dear ${userData.userName},
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          Thank you for your dedication and commitment. After reviewing your promotion request to ${userData.rank}, we were unable to approve it at this time.
        </p>

        ${userData.reason ? `
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 8px 0; color: #92400e; font-weight: bold;">Feedback</p>
          <p style="margin: 0; color: #78350f;">${userData.reason}</p>
        </div>
        ` : ''}

        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          We encourage you to continue building your network and PV points. Please reach out to your upline or support if you have questions about the requirements.
        </p>

        <a href="${window.location.origin}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px; font-weight: 600;">
          View Rank Requirements
        </a>

        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          This is an automated notification from the LifeChangers platform.
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: userData.userEmail,
    subject: `Rank Promotion Request Update - ${userData.rank}`,
    html,
    type: 'rank_promotion_rejected',
  });

  await createInAppNotification({
    type: 'promotion',
    title: 'Rank Promotion Request Update',
    message: userData.reason
      ? `Your promotion request to ${userData.rank} was not approved: ${userData.reason}`
      : `Your promotion request to ${userData.rank} was not approved at this time`,
    action_url: '/rank',
    userId: userData.userId,
  });
}

export async function sendAutoRankPromotionNotification(userData: {
  userId: string;
  userName: string;
  newRank: string;
}) {
  await createInAppNotification({
    type: 'promotion',
    title: 'Rank Promotion!',
    message: `Congratulations! You have been automatically promoted to ${userData.newRank}`,
    action_url: '/rank',
    userId: userData.userId,
  });
}

export async function sendOrderRejectedNotification(
  orderData: OrderNotificationData,
  userEmail: string,
  reason: string,
  userId?: string
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ef4444; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">Order Update Required</h2>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">Your order requires attention.</p>

        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">Order Details</h3>
          <p style="margin: 8px 0; color: #374151;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
          <p style="margin: 8px 0; color: #374151;"><strong>Product:</strong> ${orderData.productName}</p>
          <p style="margin: 8px 0; color: #374151;"><strong>Total Amount:</strong> ${orderData.totalAmount}</p>
        </div>

        <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <h3 style="margin-top: 0; color: #991b1b;">Reason</h3>
          <p style="margin: 0; color: #991b1b;">${reason}</p>
        </div>

        <p style="color: #374151;">Please contact support if you have any questions.</p>

        <a href="${window.location.origin}" style="display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px; font-weight: 600;">
          View Order Details
        </a>

        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          This is an automated notification from the LifeChangers platform.
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: userEmail,
    subject: `Order #${orderData.orderNumber} - Action Required`,
    html,
    type: 'order_rejected',
    orderData,
  });

  if (userId) {
    await createInAppNotification({
      type: 'payment',
      title: 'Order Rejected',
      message: `Your order #${orderData.orderNumber} was not approved: ${reason}`,
      action_url: '/orders',
      userId,
    });
  }
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  type: string;
  orderData?: OrderNotificationData;
}) {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification-email', {
      body: params,
    });

    if (error) {
      console.error('Error sending email:', error);
    }

    return data;
  } catch (error) {
    console.error('Error invoking email function:', error);
  }
}

async function createInAppNotification(params: {
  type: string;
  title: string;
  message: string;
  action_url?: string;
  userRole?: 'admin' | 'user' | 'admin_and_managers';
  userId?: string;
}) {
  try {
    if (params.userRole === 'admin') {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .or('role.eq.admin,is_master.eq.true');

      if (admins && admins.length > 0) {
        const uniqueAdmins = [...new Map(admins.map(a => [a.id, a])).values()];
        const notifications = uniqueAdmins.map(admin => ({
          user_id: admin.id,
          type: params.type,
          title: params.title,
          message: params.message,
          action_url: params.action_url,
        }));

        await supabase.from('notifications').insert(notifications);
      }
    } else if (params.userRole === 'admin_and_managers') {
      const { data: recipients } = await supabase
        .from('profiles')
        .select('id')
        .or('role.eq.admin,role.eq.manager,is_master.eq.true');

      if (recipients && recipients.length > 0) {
        const uniqueRecipients = [...new Map(recipients.map(r => [r.id, r])).values()];
        const notifications = uniqueRecipients.map(r => ({
          user_id: r.id,
          type: params.type,
          title: params.title,
          message: params.message,
          action_url: params.action_url,
        }));

        await supabase.from('notifications').insert(notifications);
      }
    } else if (params.userId) {
      await supabase.from('notifications').insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        action_url: params.action_url,
      });
    }
  } catch (error) {
    console.error('Error creating in-app notification:', error);
  }
}
