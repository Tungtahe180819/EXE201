const Event = require('../models/Event');
const Itinerary = require('../models/Itinerary');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  try {
    const { userQuery } = req.body;
    const prompt = `Bạn là trợ lý ảo hỗ trợ sự kiện của Eventverse. Hãy trả lời thân thiện bằng tiếng Việt câu hỏi sau: "${userQuery}"`;
    
    const aiResponse = await ai.models.generateContent({ 
      model: 'gemini-2.5-flash', 
      contents: prompt 
    });

    const replyText = aiResponse.text || "Xin lỗi, hiện tại trợ lý ảo chưa thể phản hồi.";
    
    res.status(200).json({ success: true, reply: replyText });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { generateSmartItinerary, chatbotSupport };
