const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveCartCustomerAuth } = require("../cart-customer-auth");

test("valid Customer token remains authoritative", async () => {
  const req = {};
  let cleared = false;
  const result = await resolveCartCustomerAuth(req, {}, {
    getToken: () => "valid-token",
    retrieveCustomer: async () => ({ id: "customer-one" }),
    clearCookie: () => { cleared = true; },
  });
  assert.deepEqual(result, { token: "valid-token", customer: { id: "customer-one" } });
  assert.equal(cleared, false);
});

test("only an explicit 401 clears Customer authentication", async () => {
  const req = {};
  let clears = 0;
  const dependencies = {
    getToken: () => "rejected-token",
    retrieveCustomer: async () => { throw Object.assign(new Error("Unauthorized"), { status: 401 }); },
    clearCookie: () => { clears += 1; },
  };
  assert.deepEqual(await resolveCartCustomerAuth(req, {}, dependencies), {
    token: null, customer: null,
  });
  assert.deepEqual(await resolveCartCustomerAuth(req, {}, dependencies), {
    token: null, customer: null,
  });
  assert.equal(clears, 1);
});

test("temporary Medusa failure and timeout preserve the Customer token", async () => {
  for (const failure of [Object.assign(new Error("Unavailable"), { status: 503 }), new Error("Timeout")]) {
    const req = {};
    let cleared = false;
    await assert.rejects(resolveCartCustomerAuth(req, {}, {
      getToken: () => "customer-token",
      retrieveCustomer: async () => { throw failure; },
      clearCookie: () => { cleared = true; },
    }), (error) => error === failure);
    assert.equal(cleared, false);
    assert.equal(req.cartCustomerAuth, undefined);
  }
});
