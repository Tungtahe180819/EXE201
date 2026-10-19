const fs = require('fs');
const path = require('path');
const Event = require('../models/Event');

const eventsPath = path.resolve(__dirname, '../../data/events.json');

async function syncCatalogEvents() {
  const catalog = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
  const managedEvents = catalog.filter(event => event.catalogManaged === true);

  for (const source of managedEvents) {
    const eventData = {
      title: source.title,
      category: source.category,
      description: source.description || '',
      location: source.location,
      startDate: source.startDate,
      endDate: source.endDate || source.startDate,
      price: Number(source.price) || 0,
      stock: Number(source.stock) || 0,
      image: source.image,
      sourceUrl: source.sourceUrl || '',
      totalSlots: Number(source.stock) || 0
    };
    const { image, sourceUrl, ...insertOnlyData } = eventData;

    await Event.findOneAndUpdate(
      { title: source.title },
      {
        $set: { image, sourceUrl },
        $setOnInsert: { ...insertOnlyData, bookedSlots: 0 }
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }

  return managedEvents.length;
}

module.exports = { syncCatalogEvents };
