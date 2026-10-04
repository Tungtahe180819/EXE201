const Event = require('../models/Event');
const Itinerary = require('../models/Itinerary');
const { GoogleGenAI } = require('@google/genai');

const getAI = () => {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

const categoryAliases = [
  { category: 'Ẩm thực', terms: ['ẩm thực', 'ăn uống', 'đồ ăn', 'món ăn', 'food'] },
  { category: 'Âm nhạc', terms: ['âm nhạc', 'ca nhạc', 'concert', 'music'] },
  { category: 'Công nghệ', terms: ['công nghệ', 'ai', 'robot', 'technology'] },
  { category: 'Thể thao', terms: ['thể thao', 'bóng đá', 'chạy bộ', 'sport'] },
  { category: 'Nghệ thuật', terms: ['nghệ thuật', 'triển lãm', 'art'] },
  { category: 'Giáo dục', terms: ['giáo dục', 'hội sách', 'workshop', 'education'] },
  { category: 'Gaming', terms: ['gaming', 'game', 'esport'] }
];

const formatPrice = price => Number(price || 0) === 0
  ? 'Miễn phí'
  : `${Number(price).toLocaleString('vi-VN')}₫`;

const findRelevantEvents = async userQuery => {
  const normalized = String(userQuery || '').toLocaleLowerCase('vi-VN');
  const matchedCategory = categoryAliases.find(item => item.terms.some(term => normalized.includes(term)))?.category;
  const matchedCity = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng'].find(city => normalized.includes(city.toLocaleLowerCase('vi-VN')));
  const filter = {};
  if (matchedCategory) filter.category = matchedCategory;
  if (matchedCity) filter['location.city'] = { $regex: matchedCity, $options: 'i' };
  return Event.find(filter).sort({ startDate: 1 }).limit(5).lean();
};

const localEventReply = events => {
  if (!events.length) return '';
  const recommendations = events.map((event, index) => {
    const date = event.startDate
      ? new Date(event.startDate).toLocaleString('vi-VN', { timeZone: event.timezone || 'Asia/Ho_Chi_Minh' })
      : 'đang cập nhật';
    return `${index + 1}. ${event.title} — ${date} — ${event.location?.address || event.location?.city || 'đang cập nhật địa điểm'} — ${formatPrice(event.price)}`;
  });
  return `Tôi tìm thấy các sự kiện phù hợp trong Eventverse:\n${recommendations.join('\n')}`;
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

  const relevantEvents = await findRelevantEvents(userQuery);
  const fallbackReply = localEventReply(relevantEvents);

  try {
    const ai = getAI();
    if (!ai) {
      if (fallbackReply) return res.status(200).json({ success: true, fallback: true, reply: fallbackReply });
      return res.status(503).json({ success: false, message: 'Trợ lý AI chưa được cấu hình. Vui lòng thử lại sau.' });
    }

    const eventContext = relevantEvents.map(event => ({
      title: event.title,
      category: event.category,
      price: event.price,
      startDate: event.startDate,
      location: event.location,
      description: event.description
    }));
    const prompt = `Bạn là trợ lý Eventverse. Chỉ tư vấn dựa trên dữ liệu sự kiện thật được cung cấp; không tự bịa sự kiện. Trả lời thân thiện, ngắn gọn bằng tiếng Việt.\nCâu hỏi: ${userQuery}\nDữ liệu phù hợp: ${JSON.stringify(eventContext)}`;
    
    const aiResponse = await ai.models.generateContent({ 
      model: 'gemini-2.5-flash', 
      contents: prompt 
    });

    const replyText = aiResponse.text || "Xin lỗi, hiện tại trợ lý ảo chưa thể phản hồi.";
    
    res.status(200).json({ success: true, reply: replyText });
  } catch (error) {
    console.error('Gemini chatbot thất bại:', error.message);
    if (fallbackReply) return res.status(200).json({ success: true, fallback: true, reply: fallbackReply });
    return res.status(503).json({ success: false, message: 'Trợ lý AI chưa thể phản hồi lúc này. Vui lòng thử lại sau.' });
  }
};

module.exports = { generateSmartItinerary, chatbotSupport };
