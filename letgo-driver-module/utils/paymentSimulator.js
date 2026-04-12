const processPayment = async (amount) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: `Payment of Rs. ${amount} processed successfully`
      });
    }, 1000);
  });
};
// utils/paymentSimulator.js - Simulates payment processing for card and cash payments. Used in demo routes to mimic real payment flows without actual integration.
module.exports = { processPayment };
