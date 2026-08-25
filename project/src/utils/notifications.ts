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
    titleKey: 'notif.newAccountRequestTitle',
    messageKey: 'notif.newAccountRequestMsg',
    messageParams: { name: userData.fullName, email: userData.email },
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

export async function sendPromotionNotification(data: {
  productName: string;
  title: string;
  buyQuantity: number;
  freeQuantity: number;
  startsAt?: string;
  endsAt?: string;
}) {
  const { data: recipients } = await supabase
    .from('profiles')
    .select('id, email, full_name');

  if (!recipients || recipients.length === 0) return;

  const validRecipients = recipients.filter((recipient) => recipient.email);
  if (validRecipients.length === 0) return;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f59e0b; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">New Promotion Available</h2>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">A new promotion is live for ${data.productName}.</p>
        <div style="background-color: #fff7ed; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <p style="margin: 0 0 8px 0; color: #9a4d00;"><strong>${data.title || `Buy ${data.buyQuantity} Get ${data.freeQuantity} Free`}</strong></p>
          <p style="margin: 4px 0; color: #7c2d12;">Product: ${data.productName}</p>
          <p style="margin: 4px 0; color: #7c2d12;">Buy: ${data.buyQuantity}</p>
          <p style="margin: 4px 0; color: #7c2d12;">Free: ${data.freeQuantity}</p>
          ${data.startsAt ? `<p style="margin: 4px 0; color: #7c2d12;">Starts: ${new Date(data.startsAt).toLocaleString()}</p>` : ''}
          ${data.endsAt ? `<p style="margin: 4px 0; color: #7c2d12;">Ends: ${new Date(data.endsAt).toLocaleString()}</p>` : ''}
        </div>
        <p style="color: #374151; font-size: 14px;">Visit the shop today and take advantage of this special offer.</p>
      </div>
    </div>
  `;

  await Promise.allSettled(
    validRecipients.map((recipient) =>
      sendEmail({
        to: recipient.email,
        subject: `New promotion: ${data.productName}`,
        html,
        type: 'promotion_created',
      }).then(() =>
        createInAppNotification({
          type: 'promotion',
          title: 'New Promotion Available',
          message: `${data.title || `Buy ${data.buyQuantity} Get ${data.freeQuantity} Free`} is now active for ${data.productName}.`,
          titleKey: 'notif.newPromotionTitle',
          messageKey: 'notif.newPromotionMsg',
          messageParams: { label: data.title || `Buy ${data.buyQuantity} Get ${data.freeQuantity} Free`, product: data.productName },
          action_url: '/shop',
          userId: recipient.id,
        })
      )
    )
  );
}

export async function sendOrderPlacedNotification(orderData: OrderNotificationData, userId?: string) {
  const adminSettings = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'admin_contact_email')
    .maybeSingle();

  const configuredAdminEmail = adminSettings?.data?.value?.email || 'admin@lifechangers.com';

  const { data: staff } = await supabase
    .from('profiles')
    .select('email')
    .or('role.eq.admin,role.eq.manager,is_master.eq.true');

  const staffEmails = (staff || []).map((recipient) => recipient.email).filter((email): email is string => Boolean(email));
  const adminRecipients = [...new Set([configuredAdminEmail, ...staffEmails])];

  const adminHtml = `
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

  await Promise.allSettled(
    adminRecipients.map((to) =>
      sendEmail({
        to,
        subject: `New Order #${orderData.orderNumber} - Action Required`,
        html: adminHtml,
        type: 'order_placed',
        orderData,
      })
    )
  );

  await createInAppNotification({
    type: 'approval',
    title: 'New Order Placed',
    message: `Order #${orderData.orderNumber} from ${orderData.userName} requires approval`,
    titleKey: 'notif.newOrderPlacedTitle',
    messageKey: 'notif.newOrderPlacedMsg',
    messageParams: { orderNumber: orderData.orderNumber, userName: orderData.userName },
    action_url: '/admin/orders',
    userRole: 'admin_and_managers',
  });

  if (orderData.userEmail) {
    const customerHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #ffffff; margin: 0;">Order Received</h2>
        </div>
        <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hi ${orderData.userName}, thanks for your order! We've received it and it's now pending approval.</p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Order Details</h3>
            <p style="margin: 8px 0; color: #374151;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Product:</strong> ${orderData.productName}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Quantity:</strong> ${orderData.quantity}</p>
            <p style="margin: 8px 0; color: #374151;"><strong>Total Amount:</strong> ${orderData.totalAmount}</p>
          </div>

          <p style="color: #374151;">We'll notify you as soon as it's approved with instructions to complete payment.</p>

          <a href="${window.location.origin}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px; font-weight: 600;">
            View My Orders
          </a>

          <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
            This is an automated notification from the LifeChangers platform.
          </p>
        </div>
      </div>
    `;

    await sendEmail({
      to: orderData.userEmail,
      subject: `Order #${orderData.orderNumber} Received`,
      html: customerHtml,
      type: 'order_placed',
      orderData,
    });
  }

  if (userId) {
    await createInAppNotification({
      type: 'approval',
      title: 'Order Received',
      message: `Your order #${orderData.orderNumber} has been received and is pending approval.`,
      titleKey: 'notif.orderReceivedTitle',
      messageKey: 'notif.orderReceivedMsg',
      messageParams: { orderNumber: orderData.orderNumber },
      action_url: '/orders',
      userId,
    });
  }
}

export async function sendOrderApprovedNotification(orderData: OrderNotificationData, userEmail: string) {
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

  // The in-app notification for this event is created inline by
  // OrderManagement.handleApproveOrder (with proper translation keys) -
  // creating one here too would duplicate it.
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
    titleKey: 'admin.paymentSubmitted',
    messageKey: 'notif.paymentSubmittedAdminMsg',
    messageParams: { orderNumber: orderData.orderNumber, userName: orderData.userName },
    action_url: '/admin/orders',
    userRole: 'admin',
  });
}

export async function sendPaymentVerifiedNotification(orderData: OrderNotificationData, userEmail: string) {
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

  // The in-app notification for this event is created inline by
  // OrderManagement.handleVerifyPayment (with proper translation keys) -
  // creating one here too would duplicate it.
}

export async function sendOrderRejectedNotification(
  orderData: OrderNotificationData,
  userEmail: string,
  reason: string
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

  // The in-app notification for this event is created inline by
  // OrderManagement.handleRejectOrder (with proper translation keys) -
  // creating one here too would duplicate it.
}

export interface LowStockAlertData {
  productName: string;
  region: string;
  available: number;
  threshold: number;
}

export async function sendLowStockAlert(data: LowStockAlertData) {
  const [{ data: fullAdmins }, { data: inventoryManagers }] = await Promise.all([
    supabase.from('profiles').select('id, email').or('role.eq.admin,is_master.eq.true'),
    supabase
      .from('manager_permissions')
      .select('user_id, profiles!inner(id, email)')
      .eq('permission', 'manage_inventory'),
  ]);

  const recipients = new Map<string, string>();
  (fullAdmins || []).forEach((a) => {
    if (a.email) recipients.set(a.id, a.email);
  });
  (inventoryManagers || []).forEach((m: any) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    if (p?.email) recipients.set(p.id, p.email);
  });

  if (recipients.size === 0) return;

  const dashboardUrl = `${window.location.origin}${(import.meta as any).env?.BASE_URL || '/'}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #f59e0b; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">Low Stock Alert</h2>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          <strong>${data.productName}</strong> (${data.region}) has dropped to <strong>${data.available}</strong> unit${data.available === 1 ? '' : 's'} available - at or below its low-stock threshold of ${data.threshold}.
        </p>
        <p style="color: #374151; font-size: 14px;">
          Please log in to the admin dashboard to restock.
        </p>
        <a href="${dashboardUrl}" style="display: inline-block; background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
          Manage Inventory
        </a>
        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          This is an automated notification from the LifeChangers platform.
        </p>
      </div>
    </div>
  `;

  await Promise.allSettled(
    Array.from(recipients.values()).map((to) =>
      sendEmail({
        to,
        subject: `Low Stock Alert: ${data.productName} (${data.available} left)`,
        html,
        type: 'low_stock_alert',
      })
    )
  );

  await supabase.from('notifications').insert(
    Array.from(recipients.keys()).map((userId) => ({
      user_id: userId,
      type: 'system',
      title: 'Low Stock Alert',
      message: `${data.productName} has only ${data.available} unit${data.available === 1 ? '' : 's'} left in ${data.region} (threshold: ${data.threshold}).`,
      action_url: '/admin/inventory',
    }))
  );
}

export async function maybeAlertLowStock(
  productName: string,
  region: string,
  previousAvailable: number,
  newAvailable: number,
  threshold: number
) {
  if (previousAvailable > threshold && newAvailable <= threshold) {
    await sendLowStockAlert({ productName, region, available: newAvailable, threshold });
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
  titleKey?: string;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
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
          title_key: params.titleKey,
          message_key: params.messageKey,
          message_params: params.messageParams,
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
          title_key: params.titleKey,
          message_key: params.messageKey,
          message_params: params.messageParams,
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
        title_key: params.titleKey,
        message_key: params.messageKey,
        message_params: params.messageParams,
        action_url: params.action_url,
      });
    }
  } catch (error) {
    console.error('Error creating in-app notification:', error);
  }
}
