const resolveCartCustomerAuth = async (req, res, { getToken, retrieveCustomer, clearCookie }) => {
  if (req.cartCustomerAuth) return req.cartCustomerAuth;
  const token = getToken(req);
  if (!token) return (req.cartCustomerAuth = { token: null, customer: null });

  try {
    const customer = await retrieveCustomer(token);
    return (req.cartCustomerAuth = { token, customer });
  } catch (error) {
    if (error.status !== 401) throw error;
    clearCookie(res);
    return (req.cartCustomerAuth = { token: null, customer: null });
  }
};

module.exports = { resolveCartCustomerAuth };
