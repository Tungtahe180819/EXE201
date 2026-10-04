export const isFreePrice = value => Number(value || 0) === 0;

export const formatEventPrice = value => {
  const price = Number(value || 0);
  if (price === 0) return 'Miễn phí';
  return `${price.toLocaleString('vi-VN')}₫`;
};
