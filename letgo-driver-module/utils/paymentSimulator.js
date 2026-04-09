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

module.exports = { processPayment };
