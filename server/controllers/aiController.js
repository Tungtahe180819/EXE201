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
  const candidates = await Event.find({ startDate: { $gte: now } })
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
  const candidates = await Event.find({ startDate: { $lt: new Date() } })
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

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ success: false, message: 'Ngày kết thúc phải sau ngày bắt đầu.' });
    }

    // Lọc sự kiện chính thống trong khu vực
    const events = await Event.find({ 
      "location.city": { $regex: destinationArea, $options: 'i' }
    });
    
    const eventContext = JSON.stringify(events.map(e => ({ 
      title: e.title || e.name, 
      category: e.category, 
      date: e.startDate || e.date, 
      summary: e.description 
    })));

    const prompt = `
    Bạn là trợ lý Eventverse. Người dùng muốn đi chơi từ ${startDate} đến ${endDate} tại "${destinationArea}". 
    Sở thích: "${userPreferences}". 
    Danh sách sự kiện chính thống: ${eventContext}. 
    Hãy tạo lịch trình dạng JSON sạch với các ngày và hoạt động chi tiết.
    `;

    const ai = getAI();
    if (!ai) return res.status(503).json({ success: false, message: 'Trợ lý AI chưa được cấu hình Gemini API key.' });

    const aiResponse = await ai.models.generateContent({ 
      model: 'gemini-2.5-flash', 
      contents: prompt 
    });
    
    const responseText = aiResponse.text || "";

    let parsedPlan;
    try {
      const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedPlan = JSON.parse(cleanText);
    } catch (e) {
      parsedPlan = { rawText: responseText };
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

    res.status(201).json({ success: true, message: 'Đã tạo lịch trình thông minh!', data: newItinerary });
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
      return res.status(200).json({
        success: true,
        source: 'eventverse_database',
        filters: {
          category: filters.category,
          city: filters.city,
          maxPrice: filters.budget?.amount ?? null,
          freeOnly: filters.wantsFree
        },
        reply: localEventReply(events, pastEvents, filters)
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

    const prompt = `Bạn là trợ lý hỗ trợ khách hàng của Eventverse. Trả lời ngắn gọn, thân thiện bằng tiếng Việt. Chỉ trả lời về cách dùng website và thông tin Eventverse được nêu dưới đây. Không bịa chính sách, giao dịch, sự kiện, giá vé, thời gian hoặc địa điểm. Nếu người dùng hỏi tìm/gợi ý sự kiện, hãy nói họ có thể nêu thể loại, thành phố và mức giá; việc tìm sự kiện do hệ thống dữ liệu thực hiện. Nếu không biết câu trả lời, hãy nói rõ và hướng người dùng tới mục Góp ý hoặc liên hệ hỗ trợ.\nCâu hỏi: ${userQuery}`;
    
    const aiResponse = await ai.models.generateContent({ 
      model: 'gemini-2.5-flash', 
      contents: prompt 
    });

    const replyText = aiResponse.text || 'Xin lỗi, hiện tại trợ lý ảo chưa thể phản hồi.';
    
    res.status(200).json({ success: true, reply: replyText });
  } catch (error) {
    console.error('Gemini chatbot thất bại:', error.message);
    return res.status(503).json({ success: false, message: 'Trợ lý AI chưa thể phản hồi lúc này. Vui lòng thử lại sau.' });
  }
};

module.exports = { generateSmartItinerary, chatbotSupport };
