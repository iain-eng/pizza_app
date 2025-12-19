// server.js - Pizza Pre-Order System Backend
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve frontend files from root directory

// Data file paths
const DATA_DIR = path.join(__dirname, "data");
const MENU_FILE = path.join(DATA_DIR, "menu.json");
const SLOTS_FILE = path.join(DATA_DIR, "slots.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Initialize default data files if they don't exist
const initFile = (filepath, defaultData) => {
  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, JSON.stringify(defaultData, null, 2));
  }
};

initFile(MENU_FILE, [
  { id: "1", name: "Margherita", description: "Classic tomato & mozzarella", price: 12, available: true, image: "" },
  { id: "2", name: "Pepperoni", description: "Spicy pepperoni & cheese", price: 14, available: true, image: "" },
  { id: "3", name: "Veggie Supreme", description: "Bell peppers, mushrooms, olives", price: 13, available: true, image: "" }
]);

initFile(SLOTS_FILE, [
  { id: "1", time: "17:00", capacity: 8, orders: [] },
  { id: "2", time: "17:30", capacity: 8, orders: [] },
  { id: "3", time: "18:00", capacity: 8, orders: [] },
  { id: "4", time: "18:30", capacity: 8, orders: [] },
  { id: "5", time: "19:00", capacity: 8, orders: [] },
  { id: "6", time: "19:30", capacity: 8, orders: [] }
]);

initFile(ORDERS_FILE, []);

initFile(SETTINGS_FILE, {
  businessName: "Pizza Paradise",
  tagline: "Fresh. Fast. Delicious.",
  logo: "",
  chefPassword: "chef123", // Simple password for demo - change this!
  serviceSchedule: [
    // Example: Service on Friday, orders open Tuesday 10am
    // {
    //   serviceDate: "2024-12-20", // ISO date
    //   serviceDayName: "Friday",
    //   ordersOpenAt: "2024-12-17T10:00:00", // ISO datetime
    //   enabled: true
    // }
  ]
});

// Helper functions
const readJSON = (filepath) => JSON.parse(fs.readFileSync(filepath, "utf8"));
const writeJSON = (filepath, data) => fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

// Modification pricing
const MOD_PRICES = {
  "Gluten Free": 2,
  "Vegan Cheese": 1,
  "Extra Cheese": 1
};

const calculateModificationPrice = (modifications) => {
  if (!modifications || modifications.length === 0) return 0;
  return modifications.reduce((total, mod) => total + (MOD_PRICES[mod] || 0), 0);
};

// Calculate how many pizzas are ordered in a slot
const getSlotOrderCount = (slotId) => {
  const orders = readJSON(ORDERS_FILE);
  return orders
    .filter(order => order.slotId === slotId && order.status !== "cancelled")
    .reduce((total, order) => total + order.items.reduce((sum, item) => sum + item.quantity, 0), 0);
};

// ============= MENU ROUTES =============
app.get("/api/menu", (req, res) => {
  const menu = readJSON(MENU_FILE);
  res.json(menu);
});

app.post("/api/menu", (req, res) => {
  const menu = readJSON(MENU_FILE);
  const newItem = {
    id: Date.now().toString(),
    name: req.body.name,
    description: req.body.description || "",
    price: parseFloat(req.body.price),
    available: req.body.available !== false,
    image: req.body.image || ""
  };
  menu.push(newItem);
  writeJSON(MENU_FILE, menu);
  res.json(newItem);
});

app.put("/api/menu/:id", (req, res) => {
  const menu = readJSON(MENU_FILE);
  const index = menu.findIndex(item => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Menu item not found" });
  
  menu[index] = {
    ...menu[index],
    name: req.body.name || menu[index].name,
    description: req.body.description !== undefined ? req.body.description : menu[index].description,
    price: req.body.price !== undefined ? parseFloat(req.body.price) : menu[index].price,
    available: req.body.available !== undefined ? req.body.available : menu[index].available,
    image: req.body.image !== undefined ? req.body.image : menu[index].image
  };
  
  writeJSON(MENU_FILE, menu);
  res.json(menu[index]);
});

app.delete("/api/menu/:id", (req, res) => {
  const menu = readJSON(MENU_FILE);
  const filtered = menu.filter(item => item.id !== req.params.id);
  if (filtered.length === menu.length) return res.status(404).json({ error: "Menu item not found" });
  
  writeJSON(MENU_FILE, filtered);
  res.json({ success: true });
});

// ============= SLOT ROUTES =============
app.get("/api/slots", (req, res) => {
  const slots = readJSON(SLOTS_FILE);
  
  // Add current order count and remaining capacity to each slot
  const slotsWithAvailability = slots.map(slot => ({
    ...slot,
    currentOrders: getSlotOrderCount(slot.id),
    remaining: slot.capacity - getSlotOrderCount(slot.id)
  }));
  
  res.json(slotsWithAvailability);
});

app.post("/api/slots", (req, res) => {
  const slots = readJSON(SLOTS_FILE);
  const newSlot = {
    id: Date.now().toString(),
    time: req.body.time,
    capacity: parseInt(req.body.capacity) || 8,
    orders: []
  };
  slots.push(newSlot);
  // Sort by time
  slots.sort((a, b) => a.time.localeCompare(b.time));
  writeJSON(SLOTS_FILE, slots);
  res.json(newSlot);
});

app.put("/api/slots/:id", (req, res) => {
  const slots = readJSON(SLOTS_FILE);
  const index = slots.findIndex(slot => slot.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Slot not found" });
  
  slots[index] = {
    ...slots[index],
    time: req.body.time || slots[index].time,
    capacity: req.body.capacity !== undefined ? parseInt(req.body.capacity) : slots[index].capacity
  };
  
  writeJSON(SLOTS_FILE, slots);
  res.json(slots[index]);
});

app.delete("/api/slots/:id", (req, res) => {
  const slots = readJSON(SLOTS_FILE);
  const orders = readJSON(ORDERS_FILE);
  
  // Check if slot has orders
  const hasOrders = orders.some(order => order.slotId === req.params.id && order.status !== "cancelled");
  if (hasOrders) {
    return res.status(400).json({ error: "Cannot delete slot with existing orders" });
  }
  
  const filtered = slots.filter(slot => slot.id !== req.params.id);
  if (filtered.length === slots.length) return res.status(404).json({ error: "Slot not found" });
  
  writeJSON(SLOTS_FILE, filtered);
  res.json({ success: true });
});

// ============= ORDER ROUTES =============
app.get("/api/orders", (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const slots = readJSON(SLOTS_FILE);
  const menu = readJSON(MENU_FILE);
  
  // Enrich orders with slot and menu details
  const enrichedOrders = orders.map(order => {
    const slot = slots.find(s => s.id === order.slotId);
    const items = order.items.map(item => {
      const menuItem = menu.find(m => m.id === item.menuId);
      return {
        ...item,
        name: menuItem ? menuItem.name : "Unknown Item"
      };
    });
    
    return {
      ...order,
      slotTime: slot ? slot.time : "Unknown",
      items
    };
  });
  
  res.json(enrichedOrders);
});

app.post("/api/orders", (req, res) => {
  const { slotId, items, customer, comments } = req.body;
  
  // Validate
  if (!slotId || !items || items.length === 0) {
    return res.status(400).json({ error: "Invalid order data" });
  }
  
  if (!customer || !customer.name || !customer.email) {
    return res.status(400).json({ error: "Customer name and email required" });
  }
  
  const slots = readJSON(SLOTS_FILE);
  const slot = slots.find(s => s.id === slotId);
  
  if (!slot) {
    return res.status(404).json({ error: "Slot not found" });
  }
  
  // Check capacity
  const currentOrders = getSlotOrderCount(slotId);
  const newOrderCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  if (currentOrders + newOrderCount > slot.capacity) {
    return res.status(400).json({ 
      error: "Not enough capacity", 
      remaining: slot.capacity - currentOrders,
      requested: newOrderCount
    });
  }
  
  // Calculate total
  const menu = readJSON(MENU_FILE);
  let total = 0;
  const enrichedItems = items.map(item => {
    const menuItem = menu.find(m => m.id === item.menuId);
    if (!menuItem) throw new Error("Menu item not found");
    
    const modPrice = calculateModificationPrice(item.modifications);
    const itemPrice = menuItem.price + modPrice;
    const itemTotal = itemPrice * item.quantity;
    total += itemTotal;
    
    return {
      menuId: item.menuId,
      quantity: item.quantity,
      basePrice: menuItem.price,
      modPrice: modPrice,
      price: itemPrice,
      name: menuItem.name,
      modifications: item.modifications || [],
      pizzaComments: item.pizzaComments || ""
    };
  });
  
  // Create order
  const orders = readJSON(ORDERS_FILE);
  const newOrder = {
    id: Date.now().toString(),
    slotId,
    items: enrichedItems,
    customer: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone || ""
    },
    comments: comments || "",
    total,
    status: "confirmed",
    serviceDate: req.body.serviceDate || null, // Track which service date this order is for
    createdAt: new Date().toISOString()
  };
  
  orders.push(newOrder);
  writeJSON(ORDERS_FILE, orders);
  
  res.json(newOrder);
});

app.put("/api/orders/:id/status", (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const index = orders.findIndex(order => order.id === req.params.id);
  
  if (index === -1) return res.status(404).json({ error: "Order not found" });
  
  const validStatuses = ["confirmed", "preparing", "ready", "completed", "cancelled"];
  if (!validStatuses.includes(req.body.status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  
  orders[index].status = req.body.status;
  writeJSON(ORDERS_FILE, orders);
  
  res.json(orders[index]);
});

// ============= SETTINGS ROUTES =============
app.get("/api/settings", (req, res) => {
  const settings = readJSON(SETTINGS_FILE);
  // Don't send password to frontend
  const { chefPassword, ...publicSettings } = settings;
  res.json(publicSettings);
});

app.put("/api/settings", (req, res) => {
  const settings = readJSON(SETTINGS_FILE);
  
  // Update only allowed fields
  const updatableFields = ['businessName', 'tagline', 'logo', 'chefPassword', 'serviceSchedule'];
  
  updatableFields.forEach(field => {
    if (req.body[field] !== undefined) {
      settings[field] = req.body[field];
    }
  });
  
  writeJSON(SETTINGS_FILE, settings);
  
  // Don't send password back to frontend
  const { chefPassword, ...publicSettings } = settings;
  res.json(publicSettings);
});

app.post("/api/auth/chef", (req, res) => {
  const settings = readJSON(SETTINGS_FILE);
  if (req.body.password === settings.chefPassword) {
    res.json({ success: true, token: "chef-authenticated" });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

// ============= ARCHIVE & RESET =============
app.post("/api/orders/archive", (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const ARCHIVE_DIR = path.join(DATA_DIR, "archives");
  
  // Create archives directory if it doesn't exist
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR);
  }
  
  // Create archive file with today's date
  const today = new Date().toISOString().split('T')[0];
  const archiveFile = path.join(ARCHIVE_DIR, `orders_${today}_${Date.now()}.json`);
  
  // Save current orders to archive
  writeJSON(archiveFile, {
    archivedAt: new Date().toISOString(),
    date: today,
    orders: orders
  });
  
  // Clear orders
  writeJSON(ORDERS_FILE, []);
  
  res.json({ 
    success: true, 
    archived: orders.length,
    archiveFile: path.basename(archiveFile)
  });
});

// ============= START SERVER =============
const PORT = process.env.PORT || 3001;

// ============= HOMEPAGE ROUTE (must be last) =============
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "customer.html"));
});

app.listen(PORT, () => {
  console.log(`🍕 Pizza Pre-Order Backend running on http://localhost:${PORT}`);
  console.log(`📂 Data stored in: ${DATA_DIR}`);
  console.log(`\n📱 Customer page: http://localhost:${PORT}/customer.html`);
  console.log(`👨‍🍳 Chef dashboard: http://localhost:${PORT}/chef.html`);
});
