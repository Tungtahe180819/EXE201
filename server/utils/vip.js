const VIP_ROLE = 'user_vip';
const VIP_ANNUAL_PRICE = 250000;

const createVipPeriod = (start = new Date()) => {
  const startedAt = new Date(start);
  const expiresAt = new Date(startedAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  return { startedAt, expiresAt };
};

const isVipActive = user => user?.role === VIP_ROLE
  && user.vipExpiresAt
  && new Date(user.vipExpiresAt).getTime() > Date.now();

const isCustomerRole = role => ['user', VIP_ROLE].includes(role);

module.exports = { VIP_ROLE, VIP_ANNUAL_PRICE, createVipPeriod, isVipActive, isCustomerRole };
