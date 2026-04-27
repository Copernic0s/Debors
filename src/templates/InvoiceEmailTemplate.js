/**
 * AlmaFuel Premium Email Template
 * This is a function that returns a beautiful HTML email string.
 */

export const generateInvoiceEmailHTML = ({ companyName, invoiceNumber, amount, dueDate, weekLabel }) => {
  const brandColor = '#f97316';
  const bgColor = '#070e1a';
  const cardBg = '#0c121f';
  const textColor = '#ffffff';
  const mutedColor = '#94a3b8';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${bgColor};
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: ${textColor};
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 40px 20px;
      background-color: ${cardBg};
      border-radius: 28px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      width: 60px;
      height: 60px;
      margin-bottom: 10px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .brand-title span {
      color: ${brandColor};
    }
    .content {
      text-align: center;
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 8px;
      letter-spacing: -0.03em;
    }
    .subtitle {
      color: ${mutedColor};
      font-size: 16px;
      margin-bottom: 40px;
    }
    .invoice-card {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 40px;
      text-align: left;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 15px;
    }
    .row:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .label {
      color: ${mutedColor};
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .value {
      font-weight: 700;
      font-size: 16px;
    }
    .amount-value {
      color: ${brandColor};
      font-size: 24px;
      font-weight: 800;
    }
    .btn {
      display: inline-block;
      padding: 16px 40px;
      background-color: ${brandColor};
      color: #ffffff;
      text-decoration: none;
      border-radius: 16px;
      font-weight: 800;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      box-shadow: 0 10px 20px rgba(249, 115, 22, 0.2);
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      color: ${mutedColor};
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://almafuel.com/logo-flame.png" alt="AlmaFuel" class="logo">
      <p class="brand-title">Alma<span>fuel</span></p>
    </div>
    
    <div class="content">
      <h1>New Invoice Arrived</h1>
      <p class="subtitle">Hi ${companyName}, your weekly invoice is ready for review.</p>
      
      <div class="invoice-card">
        <div class="row">
          <span class="label">Invoice Number</span>
          <span class="value">#${invoiceNumber}</span>
        </div>
        <div class="row">
          <span class="label">Week Period</span>
          <span class="value">${weekLabel}</span>
        </div>
        <div class="row">
          <span class="label">Due Date</span>
          <span class="value">${dueDate}</span>
        </div>
        <div class="row" style="margin-top: 20px;">
          <span class="label" style="line-height: 32px;">Total Amount</span>
          <span class="amount-value">$${amount}</span>
        </div>
      </div>
      
      <a href="https://almafuel-portal.vercel.app" class="btn">View Online Portal</a>
    </div>
    
    <div class="footer">
      <p>&copy; 2024 AlmaFuel Debtors Management System. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
};
