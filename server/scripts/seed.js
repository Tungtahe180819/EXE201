require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Profile = require('../models/Profile');

const dataDirectory = path.resolve(__dirname, '../../data');

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(dataDirectory, fileName), 'utf8'));
}

async function seedUsers(users) {
  for (const source of users) {
    const password = source.password.startsWith('$2')
      ? source.password
      : await bcrypt.hash(source.password, 10);

    await User.findOneAndUpdate(
      { _id: source._id },
      {
        $set: {
          username: source.email,
          email: source.email,
          password,
          name: source.name,
          avatar: source.avatar || '',
          role: source.role || 'user',
          status: source.status || 'Active'
        },
        $setOnInsert: { createdAt: source.createdAt || new Date() }
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }
}

async function seedEvents(events) {
  const eventByTitle = new Map();

  for (const source of events) {
    const event = await Event.findOneAndUpdate(
      { title: source.title },
      {
        $set: {
          category: source.category,
          description: source.description || '',
          location: source.location,
          startDate: source.startDate,
          endDate: source.endDate || source.startDate,
          price: Number(source.price) || 0,
          stock: Number(source.stock) || 0,
          image: source.image,
          totalSlots: Number(source.stock) || 0
        },
        $setOnInsert: { bookedSlots: 0 }
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
    eventByTitle.set(event.title, event);
  }

  return eventByTitle;
}

async function seedProfiles(profiles) {
  for (const source of profiles) {
    await Profile.findOneAndUpdate(
      { userId: source.userId },
      {
        $set: {
          bio: source.bio || '',
          phoneNumber: source.phone || '',
          interests: source.interests || [],
          facebook: source.facebook || '',
          website: source.website || ''
        }
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }
}

async function seedTickets(tickets, eventByTitle) {
  const bookedByEvent = new Map();

  for (const source of tickets) {
    const event = eventByTitle.get(source.eventTitle);
    if (!event) {
      console.warn(`Bỏ qua vé ${source.ticketCode}: không tìm thấy sự kiện "${source.eventTitle}".`);
      continue;
    }

    const ticket = await Ticket.findOneAndUpdate(
      { ticketCode: source.ticketCode },
      {
        $set: {
          userId: source.userId,
          eventId: event._id,
          quantity: Number(source.quantity) || 1,
          totalPrice: Number(source.totalPrice) || 0,
          ticketType: event.category || 'Standard',
          status: source.status || 'Confirmed',
          paymentStatus: 'Paid',
          paidAt: source.purchaseDate || new Date(),
          emailDeliveryStatus: 'Pending',
          createdAt: source.purchaseDate || new Date()
        }
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    await User.findByIdAndUpdate(source.userId, { $addToSet: { history: ticket._id } });
    bookedByEvent.set(event.id, (bookedByEvent.get(event.id) || 0) + ticket.quantity);
  }

  for (const [eventId, quantity] of bookedByEvent) {
    await Event.findByIdAndUpdate(eventId, { $set: { bookedSlots: quantity } });
  }
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Thiếu MONGO_URI trong server/.env');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Đã kết nối MongoDB. Bắt đầu nhập dữ liệu...');

  const users = readJson('users.json');
  const events = readJson('events.json');
  const profiles = readJson('profiles.json');
  const tickets = readJson('tickets.json');

  await seedUsers(users);
  const eventByTitle = await seedEvents(events);
  await seedProfiles(profiles);
  await seedTickets(tickets, eventByTitle);

  const [userCount, eventCount, profileCount, ticketCount] = await Promise.all([
    User.countDocuments(),
    Event.countDocuments(),
    Profile.countDocuments(),
    Ticket.countDocuments()
  ]);

  console.log(`Seed thành công: ${userCount} users, ${eventCount} events, ${profileCount} profiles, ${ticketCount} tickets.`);
}

main()
  .catch(error => {
    console.error('Seed thất bại:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
