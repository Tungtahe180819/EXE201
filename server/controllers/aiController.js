const Event = require('../models/Event');
const Itinerary = require('../models/Itinerary');
const { GoogleGenAI } = require('@google/genai');

const getAI = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

const categoryAliases = [
  { category: 'Ẩm thực', terms: ['am thuc', 'an uong', 'do an', 'mon an', 'food', 'nha hang'] },
  { category: 'Âm nhạc', terms: ['am nhac', 'ca nhac', 'concert', 'music', 'nhac'] },
  { category: 'Công nghệ', terms: ['cong nghe', 'robot', 'technology', 'tech'] },
  { category: 'Thể thao', terms: ['the thao', 'bong da', 'chay bo', 'sport', 'marathon'] },
  { category: 'Nghệ thuật', terms: ['nghe thuat', 'trien lam', 'art', 'thoi trang', 'thiet ke'] },
  { category: 'Giáo dục', terms: ['giao duc', 'hoi sach', 'workshop', 'education', 'hoi thao'] },
  { category: 'Gaming', terms: ['gaming', 'game', 'esport', 'e-sport'] }
];

const normalizeText = value => String(value || '')
  .toLocaleLowerCase('vi-VN')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const formatPrice = price => Number(price || 0) === 0
  ? 'Miễn phí'
  : `${Number(price).toLocaleString('vi-VN')}₫`;

const parseBudget = normalizedQuery => {
  const match = normalizedQuery.match(/(?:duoi|toi da|khong qua|khong hon|under|less than|at most|<=|<|tam|khoang|around)\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|tr|trieu|d|dong)?\b/);
  if (!match) return null;

  const rawNumber = match[1];
  const number = /[.,]\d{3}$/.test(rawNumber)
    ? Number(rawNumber.replace(/[.,]/g, ''))
    : Number(rawNumber.replace(',', '.'));
  if (!Number.isFinite(number)) return null;

  const unit = match[2] || '';
  const multiplier = ['k', 'nghin', 'ngan'].includes(unit)
    ? 1000
    : ['tr', 'trieu'].includes(unit) ? 1000000 : 1;
  return { amount: Math.round(number * multiplier), source: match[0] };
};

const detectEventFilters = userQuery => {
  const normalized = normalizeText(userQuery).replace(/\s+/g, ' ').trim();
  const paddedQuery = ` ${normalized} `;
  const matchedCategory = categoryAliases.find(item => item.terms.some(term => paddedQuery.includes(` ${term} `)));
  let city = null;
  if (/\bha noi\b/.test(normalized)) city = 'Hà Nội';
  else if (/\b(ho chi minh|tp hcm|tphcm|sai gon)\b/.test(normalized)) city = 'Hồ Chí Minh';
  else if (/\bda nang\b/.test(normalized)) city = 'Đà Nẵng';
  else if (/\bcan tho\b/.test(normalized)) city = 'Cần Thơ';

  const budget = parseBudget(normalized);
  const wantsFree = /\b(mien phi|free|khong mat phi|0 dong|0d)\b/.test(normalized);
  const asksForEvents = Boolean(
    matchedCategory || city || budget || wantsFree
    || /\b(su kien|ve|ticket|concert|workshop|hoi thao|di dau|choi gi|goi y|tim|tim kiem|sap toi)\b/.test(normalized)
  );

  return { asksForEvents, category: matchedCategory?.category || null, city, budget, wantsFree };
};

const findRelevantEvents = async filters => {
  const now = new Date();
  const candidates = await Event.find({ isPublished: { $ne: false }, startDate: { $gte: now } })
    .sort({ startDate: 1 })
    .limit(500)
    .lean();

  return candidates.filter(event => {
    const totalSlots = Number(event.totalSlots ?? event.stock ?? 100);
    const available = Math.max(0, totalSlots - Number(event.bookedSlots || 0));
    if (!available) return false;
    if (filters.category && normalizeText(event.category) !== normalizeText(filters.category)) return false;
    if (filters.city && !normalizeText(`${event.location?.city || ''} ${event.location?.address || ''}`).includes(normalizeText(filters.city))) return false;
    if (filters.wantsFree && Number(event.price || 0) !== 0) return false;
    if (filters.budget && Number(event.price || 0) >= filters.budget.amount) return false;
    return true;
  }).slice(0, 5);
};

const findMatchingPastEvents = async filters => {
  const candidates = await Event.find({ isPublished: { $ne: false }, startDate: { $lt: new Date() } })
    .sort({ startDate: -1 })
    .limit(500)
    .lean();

  return candidates.filter(event => {
    if (filters.category && normalizeText(event.category) !== normalizeText(filters.category)) return false;
    if (filters.city && !normalizeText(`${event.location?.city || ''} ${event.location?.address || ''}`).includes(normalizeText(filters.city))) return false;
    if (filters.wantsFree && Number(event.price || 0) !== 0) return false;
    if (filters.budget && Number(event.price || 0) >= filters.budget.amount) return false;
    return true;
  }).slice(0, 3);
};

const formatEventLine = (event, index) => {
  const date = event.startDate
    ? new Date(event.startDate).toLocaleString('vi-VN', {
      timeZone: event.timezone || 'Asia/Ho_Chi_Minh',
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    : 'đang cập nhật';
  return `${index + 1}. ${event.title}\n   Giá vé: ${formatPrice(event.price)}\n   Thời gian: ${date}\n   Địa điểm: ${event.location?.address || event.location?.city || 'đang cập nhật địa điểm'}`;
};

const createDatabaseItinerary = (events, { destinationArea, startDate, endDate, userPreferences }) => ({
  summary: events.length
    ? `Lịch trình tại ${destinationArea} từ ${startDate} đến ${endDate}, sắp xếp theo sự kiện đang có trong Eventverse. Sở thích: ${userPreferences}.`
    : `Hiện chưa có sự kiện phù hợp tại ${destinationArea} từ ${startDate} đến ${endDate}. Hãy thử đổi khu vực hoặc khoảng ngày.`,
  days: events.map(event => ({
    date: event.startDate,
    title: event.title,
    category: event.category,
    venue: event.location?.address || event.location?.city || 'Địa điểm đang cập nhật',
    price: formatPrice(event.price),
    description: event.description || ''
  })),
  source: 'eventverse_database'
});

const findItineraryEvents = async ({ destinationArea, startDate, endDate }) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);
  const area = normalizeText(destinationArea).trim();
  const areaTokens = area.split(/\s+/).filter(Boolean);
  const candidates = await Event.find({ isPublished: { $ne: false }, startDate: { $gte: start, $lte: end } })
    .sort({ startDate: 1 })
    .limit(500)
    .lean();

  return candidates.filter(event => {
    const location = normalizeText(`${event.location?.city || ''} ${event.location?.address || ''}`);
    const available = Number(event.totalSlots ?? event.stock ?? 100) - Number(event.bookedSlots || 0);
    return areaTokens.every(token => location.includes(token)) && available > 0;
  });
};

const localEventReply = (events, pastEvents, filters) => {
  if (!events.length && pastEvents.length) {
    const pastList = pastEvents.map(formatEventLine).join('\n\n');
    return `Bạn nói đúng: Eventverse có sự kiện khớp điều kiện giá${filters.category ? ` và thể loại ${filters.category}` : ''}${filters.city ? ` tại ${filters.city}` : ''}. Tuy nhiên, các sự kiện này đã qua ngày tổ chức nên không còn đặt vé được.\n\n${pastList}\n\nHiện chưa có sự kiện sắp diễn ra phù hợp. Danh sách sự kiện trên trang hiện vẫn gồm cả sự kiện đã qua.`;
  }

  if (!events.length) {
    const criteria = [
      filters.category && `thể loại ${filters.category}`,
      filters.city && `khu vực ${filters.city}`,
      filters.budget && `giá dưới ${formatPrice(filters.budget.amount)}`,
      filters.wantsFree && 'sự kiện miễn phí'
    ].filter(Boolean);
    const criterionText = criteria.length ? ` theo tiêu chí ${criteria.join(', ')}` : '';
    return `Hiện Eventverse chưa có sự kiện sắp diễn ra còn vé${criterionText}.`;
  }

  const recommendations = events.map(formatEventLine);
  return `Tôi đã lọc các sự kiện sắp diễn ra còn vé trong Eventverse${filters.budget ? ` với giá dưới ${formatPrice(filters.budget.amount)}` : ''}${filters.category ? ` thuộc thể loại ${filters.category}` : ''}${filters.city ? ` tại ${filters.city}` : ''}${filters.wantsFree ? ' miễn phí' : ''}:\n\n${recommendations.join('\n\n')}`;
};

// 1. AI Lên lịch trình du lịch & sự kiện chính thống
const generateSmartItinerary = async (req, res) => {
  try {
    const { destinationArea, startDate, endDate, userPreferences } = req.body;

    if (!destinationArea || !startDate || !endDate || !userPreferences) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ địa điểm, ngày bắt đầu, ngày kết thúc và sở thích.' });
    }

    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: 'Ngày bắt đầu hoặc ngày kết thúc không hợp lệ.' });
    }
    if (end < start) {
      return res.status(400).json({ success: false, message: 'Ngày kết thúc phải sau ngày bắt đầu.' });
    }

    const events = await findItineraryEvents({ destinationArea, startDate, endDate });
    const fallbackPlan = createDatabaseItinerary(events, { destinationArea, startDate, endDate, userPreferences });
    const ai = getAI();
    let parsedPlan = fallbackPlan;

    // Gemini is optional: use only verified Eventverse event data if no key is configured or Gemini fails.
    if (ai && events.length) {
      const eventContext = JSON.stringify(events.map(event => ({
        id: String(event._id),
        title: event.title,
        category: event.category,
        date: event.startDate,
        summary: event.description,
        venue: event.location?.address,
        price: event.price
      })));
      const prompt = `Bạn là trợ lý lên lịch của Eventverse. Tạo lịch trình ngắn gọn bằng tiếng Việt cho ${destinationArea}, từ ${startDate} đến ${endDate}. Sở thích: ${userPreferences}. Chỉ sử dụng sự kiện trong JSON bên dưới; không được bịa sự kiện, ngày, địa điểm hoặc giá. Trả về JSON có summary và days.\nDỮ LIỆU SỰ KIỆN: ${eventContext}`;

      try {
        const aiResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        const cleanText = (aiResponse.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const generatedPlan = JSON.parse(cleanText);
        if (generatedPlan && typeof generatedPlan === 'object') parsedPlan = generatedPlan;
      } catch (aiError) {
        console.error('Gemini itinerary failed; using Eventverse data fallback:', aiError.message);
      }
    }

    const newItinerary = new Itinerary({
      user: req.user.id,
      title: `Lịch trình khám phá ${destinationArea}`,
      destinationArea,
      startDate,
      endDate,
      aiGeneratedPlan: parsedPlan
    });
    await newItinerary.save();

    res.status(201).json({
      success: true,
      message: ai ? 'Đã tạo lịch trình thông minh!' : 'Đã tạo lịch trình từ dữ liệu sự kiện Eventverse.',
      data: newItinerary,
      plan: parsedPlan
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Chatbot AI hỗ trợ khách hàng
const chatbotSupport = async (req, res) => {
  const userQuery = String(req.body.userQuery || '').trim();
  if (!userQuery) return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi.' });

  const filters = detectEventFilters(userQuery);
  if (filters.asksForEvents) {
    try {
      const events = await findRelevantEvents(filters);
      const pastEvents = events.length ? [] : await findMatchingPastEvents(filters);
      const ai = getAI();
      if (!events.length && ai) {
        try {
          const prompt = `Bạn là trợ lý gợi ý hoạt động và sự kiện bằng tiếng Việt. Người dùng hỏi: ${userQuery}\nDữ liệu Eventverse hiện không có sự kiện sắp tới còn vé khớp chính xác. Hãy nói rõ điều này trước. Sau đó gợi ý tối đa 3 hướng tìm kiếm/loại hoạt động bên ngoài Eventverse phù hợp với địa điểm, sở thích và mức giá nếu có. Không được khẳng định một sự kiện cụ thể đang diễn ra, ngày giờ, giá vé hay còn vé nếu không có nguồn xác minh. Gắn nhãn rõ đây là gợi ý tham khảo chưa được Eventverse xác minh và khuyên kiểm tra trang của ban tổ chức.`;
          const aiResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
          return res.status(200).json({ success: true, source: 'general_ai', reply: aiResponse.text || localEventReply(events, pastEvents, filters), remainingUses: req.chatbotTrialRemaining });
        } catch (error) {
          console.error('Gemini gợi ý sự kiện thất bại:', error.message);
        }
      }
      return res.status(200).json({
        success: true,
        source: 'eventverse_database',
        filters: {
          category: filters.category,
          city: filters.city,
          maxPrice: filters.budget?.amount ?? null,
          freeOnly: filters.wantsFree
        },
        reply: localEventReply(events, pastEvents, filters),
        remainingUses: req.chatbotTrialRemaining
      });
    } catch (error) {
      console.error('Không thể tìm sự kiện cho chatbot:', error.message);
      return res.status(500).json({ success: false, message: 'Chưa thể tìm sự kiện lúc này. Vui lòng thử lại.' });
    }
  }

  try {
    const ai = getAI();
    if (!ai) {
      return res.status(503).json({ success: false, message: 'Trợ lý AI chưa được cấu hình. Bạn vẫn có thể hỏi tôi để tìm sự kiện theo giá, thể loại hoặc địa điểm.' });
    }

    const prompt = `Bạn là trợ lý Eventverse, trả lời tự nhiên, hữu ích và chi tiết bằng tiếng Việt. Bạn có thể tư vấn chung về ý tưởng đi chơi, loại hình sự kiện, cách lên kế hoạch và cách sử dụng website. Không được bịa trạng thái đơn hàng, chính sách hoàn tiền, nội dung website hoặc khẳng định sự kiện cụ thể đang diễn ra/còn vé khi chưa có dữ liệu xác minh. Nếu gợi ý hoạt động không có trong dữ liệu Eventverse, nói rõ đó chỉ là gợi ý tham khảo bên ngoài, chưa được xác minh lịch/giá, và khuyên kiểm tra trang của ban tổ chức. Với yêu cầu hỗ trợ giao dịch, hướng dẫn người dùng vào Trung tâm hỗ trợ hoặc biểu mẫu Góp ý/Khiếu nại.\nCâu hỏi: ${userQuery}`;
    
    const aiResponse = await ai.models.generateContent({ 
      model: 'gemini-2.5-flash', 
      contents: prompt 
    });

    const replyText = aiResponse.text || 'Xin lỗi, hiện tại trợ lý ảo chưa thể phản hồi.';
    
    res.status(200).json({ success: true, reply: replyText, remainingUses: req.chatbotTrialRemaining });
  } catch (error) {
    console.error('Gemini chatbot thất bại:', error.message);
    return res.status(503).json({ success: false, message: 'Trợ lý AI chưa thể phản hồi lúc này. Vui lòng thử lại sau.' });
  }
};

module.exports = { generateSmartItinerary, chatbotSupport };
