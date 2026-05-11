import { generateInvoiceEmailHTML } from '../templates/InvoiceEmailTemplate';

/**
 * Service to handle email notifications via Resend
 */
export const emailService = {
  /**
   * Send an invoice notification email
   */
  sendInvoiceNotification: async (invoiceData) => {
    const { company, email, invoiceNumber, amount, dueDate, weekLabel } = invoiceData;

    if (!email) {
      console.warn(`[EmailService] Skipping notification for ${company}: No email address.`);
      return { success: false, error: 'No email address provided' };
    }

    try {
      // In a real production environment, this would call a Supabase Edge Function 
      // or a Vercel API Route to avoid exposing the Resend API Key on the client side.
      
      console.log(`[EmailService] Preparing email for ${company} (${email})...`);
      
      const htmlContent = generateInvoiceEmailHTML({
        companyName: company,
        invoiceNumber,
        amount,
        dueDate,
        weekLabel
      });

      // For now, we simulate the call. 
      // Tomorrow we will replace this with the actual fetch to the backend.
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `AlmaFuel: New Invoice #${invoiceNumber} for ${company}`,
          html: htmlContent
        })
      });

      if (!response.ok) throw new Error('Failed to send email');

      return { success: true };
    } catch (error) {
      console.error('[EmailService] Error:', error);
      return { success: false, error: error.message };
    }
  }
};
