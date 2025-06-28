// utils/emailService.ts

import emailjs from '@emailjs/browser';

// Initialize EmailJS with your public key
emailjs.init("public key"); // Replace with your EmailJS public key

export const sendLoanStatusEmail = async (
  loanId: number,
  amount: string,
  status: 'approved' | 'denied',
  personalCID: string,
  financialCID: string
) => {
  const templateParams = {
    
    to_email: 'static email address', // Your static email address
    loan_id: loanId.toString(),
    loan_amount: amount,
    loan_status: status.toUpperCase(),
    personal_cid: personalCID,
    financial_cid: financialCID,
    from_name: 'Bank DApp',
    to_name: 'Applicant',
  };

  try {
    /*const response = await emailjs.send(
      'service ID', // Replace with your EmailJS service ID
      'template ID', // Replace with your EmailJS template ID
      templateParams
    );*/

    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};