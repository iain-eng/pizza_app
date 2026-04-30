// server.js - Pizza Pre-Order System Backend
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

// ============= RESEND EMAIL =============
// npm install resend
let Resend;
try {
  Resend = require("resend").Resend;
} catch (e) {
  console.warn("Resend not installed — emails disabled. Run: npm install resend");
}

const resend = Resend && process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = "orders@reorientplaces.com";
const CHEF_EMAIL = "admin@reorientplaces.com";

function buildCustomerEmail(order, businessName, slot) {
  const itemRows = order.items.map(item => {
    const mods = item.modifications && item.modifications.length > 0
      ? `<div style="font-size:13px;color:#a8a29e;margin-top:3px;">${item.modifications.join(", ")}</div>`
      : "";
    const comment = item.pizzaComments
      ? `<div style="font-size:13px;color:#a8a29e;font-style:italic;margin-top:2px;">"${item.pizzaComments}"</div>`
      : "";
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e8e2d9;vertical-align:top;">
          <div style="font-weight:500;color:#1c1917;">${item.name} x${item.quantity}</div>
          ${mods}${comment}
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #e8e2d9;text-align:right;vertical-align:top;font-weight:600;color:#1c1917;">
          £${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>`;
  }).join("");

  const serviceDateLine = order.serviceDate
    ? `<p style="margin:0 0 6px;color:#57534e;font-size:15px;">
        <strong>Date:</strong> ${new Date(order.serviceDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
       </p>`
    : "";

  const commentsBlock = order.comments
    ? `<div style="margin-top:20px;padding:14px 16px;background:#f0e6e0;border-left:3px solid #c2714f;border-radius:0 4px 4px 0;font-size:14px;color:#57534e;">
        <strong>Your note:</strong> ${order.comments}
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#faf8f4;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background:#ffffff;border:1px solid #e8e2d9;border-bottom:none;border-radius:4px 4px 0 0;padding:32px 32px 24px;text-align:center;">
              <h1 style="margin:0 0 6px;font-family:Georgia,'Playfair Display',serif;font-size:26px;font-weight:700;color:#1c1917;letter-spacing:-0.3px;">
                ${businessName}
              </h1>
              <p style="margin:0;color:#a8a29e;font-size:14px;">Order Confirmation</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;border:1px solid #e8e2d9;border-top:none;border-bottom:none;padding:0 32px 32px;">

              <p style="margin:0 0 24px;font-size:16px;color:#1c1917;">
                Thanks <strong>${order.customer.name}</strong>, your order is confirmed.
              </p>

              <!-- Pickup details -->
              <div style="background:#faf8f4;border:1px solid #e8e2d9;border-radius:4px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;font-weight:600;">Collection Details</p>
                ${serviceDateLine}
                <p style="margin:0;color:#57534e;font-size:15px;">
                  <strong>Pick up at:</strong> ${slot ? slot.time : "See your order details"}
                </p>
              </div>

              <!-- Order items -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <thead>
                  <tr>
                    <th style="text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#a8a29e;font-weight:600;padding-bottom:8px;border-bottom:2px solid #e8e2d9;">Item</th>
                    <th style="text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#a8a29e;font-weight:600;padding-bottom:8px;border-bottom:2px solid #e8e2d9;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
                <tfoot>
                  <tr>
                    <td style="padding-top:16px;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1c1917;">Total</td>
                    <td style="padding-top:16px;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#1c1917;text-align:right;">£${order.total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>

              ${commentsBlock}

              <!-- Collection reminder -->
              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e8e2d9;font-size:13px;color:#a8a29e;line-height:1.6;">
                Please collect your order within 20 minutes of your time slot. If you need to make any changes, get in touch as soon as possible.
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#faf8f4;border:1px solid #e8e2d9;border-top:none;border-radius:0 0 4px 4px;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a8a29e;">Order #${order.id.slice(-6)}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildChefText(order, businessName, slot) {
  const itemLines = order.items.map(item => {
    let line = `  ${item.quantity}x ${item.name} — £${item.price.toFixed(2)}`;
    if (item.modifications && item.modifications.length > 0) {
      line += `\n    Extras: ${item.modifications.join(", ")}`;
    }
    if (item.pizzaComments) {
      line += `\n    Note: ${item.pizzaComments}`;
    }
    return line;
  }).join("\n");

  const serviceDate = order.serviceDate
    ? new Date(order.serviceDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
    : null;

  return `New order for ${businessName}

Order #${order.id.slice(-6)}
${serviceDate ? `Service date: ${serviceDate}\n` : ""}Pickup slot: ${slot ? slot.time : "Unknown"}

Customer: ${order.customer.name}
Email: ${order.customer.email}
Phone: ${order.customer.phone || "Not provided"}

Items:
${itemLines}
${order.comments ? `\nOrder note: ${order.comments}` : ""}

Total: £${order.total.toFixed(2)}
`;
}

async function sendOrderEmails(order, businessName, slot) {
  if (!resend) {
    console.log("Email skipped — Resend not configured");
    return;
  }
  const subject = `Order confirmed — #${order.id.slice(-6)} — ${businessName}`;

  // Customer email
  resend.emails.send({
    from: `${businessName} <${FROM_EMAIL}>`,
    to: order.customer.email,
    subject,
    html: buildCustomerEmail(order, businessName, slot),
  }).catch(err => console.error("Customer email failed:", err.message));

  // Chef email
  resend.emails.send({
    from: `${businessName} <${FROM_EMAIL}>`,
    to: CHEF_EMAIL,
    subject: `New order #${order.id.slice(-6)} — ${order.customer.name} — ${slot ? slot.time : "?"}`,
    text: buildChefText(order, businessName, slot),
  }).catch(err => console.error("Chef email failed:", err.message));
}

// ============= EXPRESS SETUP =============
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Data file paths
const DATA_DIR = path.join(__dirname, "data");
const MENU_FILE = path.join(DATA_DIR, "menu.json");
const SLOTS_FILE = path.join(DATA_DIR, "slots.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

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
  businessName: "Pizza Truck no.1",
  tagline: "Fresh. Fast. Delicious.",
  logo: "",
  chefPassword: "chef123",
  extras: [
    { id: "1", name: "Gluten Free Base", price: 2, available: true },
    { id: "2", name: "Vegan Cheese", price: 1, available: true },
    { id: "3", name: "Extra Cheese", price: 1, available: true }
  ],
  serviceSchedule: []
});

// Helper functions
const readJSON = (filepath) => JSON.parse(fs.readFileSync(filepath, "utf8"));
const writeJSON = (filepath, data) => fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

const getExtras = () => {
  const settings = readJSON(SETTINGS_FILE);
  return settings.extras || [];
};

const calculateModificationPrice = (modifications) => {
  if (!modifications || modifications.length === 0) return 0;
  const extras = getExtras();
  return modifications.reduce((total, modName) => {
    const extra = extras.find(e => e.name === modName && e.available);
    return total + (extra ? extra.price : 0);
  }, 0);
};

const getSlotOrderCount = (slotId) => {
  const orders = readJSON(ORDERS_FILE);
  return orders
    .filter(order => order.slotId === slotId && order.status !== "cancelled")
    .reduce((total, order) => total + order.items.reduce((sum, item) => sum + item.quantity, 0), 0);
};

// ============= MENU ROUTES =============
app.get("/api/menu", (req, res) => res.json(readJSON(MENU_FILE)));

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

// ============= EXTRAS ROUTES =============
app.get("/api/extras", (req, res) => res.json(getExtras()));

app.post("/api/extras", (req, res) => {
  const settings = readJSON(SETTINGS_FILE);
  if (!settings.extras) settings.extras = [];
  const newExtra = {
    id: Date.now().toString(),
    name: req.body.name,
    price: parseFloat(req.body.price),
    available: req.body.available !== false
  };
  settings.extras.push(newExtra);
  writeJSON(SETTINGS_FILE, settings);
  res.json(newExtra);
});

app.put("/api/extras/:id", (req, res) => {
  const settings = readJSON(SETTINGS_FILE);
  if (!settings.extras) settings.extras = [];
  const index = settings.extras.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Extra not found" });
  settings.extras[index] = {
    ...settings.extras[index],
    name: req.body.name !== undefined ? req.body.name : settings.extras[index].name,
    price: req.body.price !== undefined ? parseFloat(req.body.price) : settings.extras[index].price,
    available: req.body.available !== undefined ? req.body.available : settings.extras[index].available
  };
  writeJSON(SETTINGS_FILE, settings);
  res.json(settings.extras[index]);
});

app.delete("/api/extras/:id", (req, res) => {
  const settings = readJSON(SETTINGS_FILE);
  if (!settings.extras) settings.extras = [];
  const filtered = settings.extras.filter(e => e.id !== req.params.id);
  if (filtered.length === settings.extras.length) return res.status(404).json({ error: "Extra not found" });
  settings.extras = filtered;
  writeJSON(SETTINGS_FILE, settings);
  res.json({ success: true });
});

// ============= SLOT ROUTES =============
app.get("/api/slots", (req, res) => {
  const slots = readJSON(SLOTS_FILE);
  const slotsWithAvailability = slots.map(slot => ({
    ...slot,
    currentOrders: getSlotOrderCount(slot.id),
    remaining: slot.capacity - getSlotOrderCount(slot.id)
  }));
  res.json(slotsWithAvailability);
});

app.post("/api/slots", (req, res) => {
  const slots = readJSON(SLOTS_FILE);
  const newSlot = { id: Date.now().toString(), time: req.body.time, capacity: parseInt(req.body.capacity) || 8, orders: [] };
  slots.push(newSlot);
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
  const hasOrders = orders.some(order => order.slotId === req.params.id && order.status !== "cancelled");
  if (hasOrders) return res.status(400).json({ error: "Cannot delete slot with existing orders" });
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
  const enrichedOrders = orders.map(order => {
    const slot = slots.find(s => s.id === order.slotId);
    const items = order.items.map(item => {
      const menuItem = menu.find(m => m.id === item.menuId);
      return { ...item, name: menuItem ? menuItem.name : "Unknown Item" };
    });
    return { ...order, slotTime: slot ? slot.time : "Unknown", items };
  });
  res.json(enrichedOrders);
});

app.post("/api/orders", (req, res) => {
  const { slotId, items, customer, comments } = req.body;
  if (!slotId || !items || items.length === 0) return res.status(400).json({ error: "Invalid order data" });
  if (!customer || !customer.name || !customer.email) return res.status(400).json({ error: "Customer name and email required" });

  const slots = readJSON(SLOTS_FILE);
  const slot = slots.find(s => s.id === slotId);
  if (!slot) return res.status(404).json({ error: "Slot not found" });

  const currentOrders = getSlotOrderCount(slotId);
  const newOrderCount = items.reduce((sum, item) => sum + item.quantity, 0);
  if (currentOrders + newOrderCount > slot.capacity) {
    return res.status(400).json({ error: "Not enough capacity", remaining: slot.capacity - currentOrders, requested: newOrderCount });
  }

  const menu = readJSON(MENU_FILE);
  let total = 0;
  const enrichedItems = items.map(item => {
    const menuItem = menu.find(m => m.id === item.menuId);
    if (!menuItem) throw new Error("Menu item not found");
    const modPrice = calculateModificationPrice(item.modifications);
    const itemPrice = menuItem.price + modPrice;
    total += itemPrice * item.quantity;
    return {
      menuId: item.menuId,
      quantity: item.quantity,
      basePrice: menuItem.price,
      modPrice,
      price: itemPrice,
      name: menuItem.name,
      modifications: item.modifications || [],
      pizzaComments: item.pizzaComments || ""
    };
  });

  const orders = readJSON(ORDERS_FILE);
  const newOrder = {
    id: Date.now().toString(),
    slotId,
    items: enrichedItems,
    customer: { name: customer.name, email: customer.email, phone: customer.phone || "" },
    comments: comments || "",
    total,
    status: "confirmed",
    serviceDate: req.body.serviceDate || null,
    createdAt: new Date().toISOString()
  };
  orders.push(newOrder);
  writeJSON(ORDERS_FILE, orders);

  // Send emails — non-blocking, never affects order response
  const settings = readJSON(SETTINGS_FILE);
  sendOrderEmails(newOrder, settings.businessName || "Pizza Truck no.1", slot);

  res.json(newOrder);
});

app.put("/api/orders/:id/status", (req, res) => {
  const orders = readJSON(ORDERS_FILE);
  const index = orders.findIndex(order => order.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Order not found" });
  const validStatuses = ["confirmed", "preparing", "ready", "completed", "cancelled"];
  if (!validStatuses.includes(req.body.status)) return res.status(400).json({ error: "Invalid status" });
  orders[index].status = req.body.status;
  writeJSON(ORDERS_FILE, orders);
  res.json(orders[index]);
});

// ============= SETTINGS ROUTES =============
app.get("/api/settings", (req, res) => {
  const settings = readJSON(SETTINGS_FILE);
  const { chefPassword, ...publicSettings } = settings;
  res.json(publicSettings);
});

app.put("/api/settings", (req, res) => {
  const settings = readJSON(SETTINGS_FILE);
  const updatableFields = ['businessName', 'tagline', 'logo', 'chefPassword', 'serviceSchedule', 'extras'];
  updatableFields.forEach(field => {
    if (req.body[field] !== undefined) settings[field] = req.body[field];
  });
  writeJSON(SETTINGS_FILE, settings);
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
  const { serviceDate, serviceDates } = req.body || {};
  const ARCHIVE_DIR = path.join(DATA_DIR, "archives");
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR);

  let ordersToArchive, ordersToKeep;
  if (serviceDate) {
    ordersToArchive = orders.filter(o => o.serviceDate === serviceDate);
    ordersToKeep = orders.filter(o => o.serviceDate !== serviceDate);
  } else if (serviceDates && Array.isArray(serviceDates)) {
    ordersToArchive = orders.filter(o => serviceDates.includes(o.serviceDate));
    ordersToKeep = orders.filter(o => !serviceDates.includes(o.serviceDate));
  } else {
    ordersToArchive = orders;
    ordersToKeep = [];
  }

  if (ordersToArchive.length === 0) return res.json({ success: true, archived: 0, archiveFile: null });

  const today = new Date().toISOString().split('T')[0];
  const archiveFile = path.join(ARCHIVE_DIR, `orders_${today}_${Date.now()}.json`);
  writeJSON(archiveFile, { archivedAt: new Date().toISOString(), date: today, serviceDate: serviceDate || null, serviceDates: serviceDates || null, orders: ordersToArchive });
  writeJSON(ORDERS_FILE, ordersToKeep);
  res.json({ success: true, archived: ordersToArchive.length, archiveFile: path.basename(archiveFile) });
});

// ============= START SERVER =============
const PORT = process.env.PORT || 3001;

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "customer.html")));

app.listen(PORT, () => {
  console.log(`🍕 Pizza Pre-Order Backend running on http://localhost:${PORT}`);
  console.log(`📂 Data stored in: ${DATA_DIR}`);
  console.log(`📧 Resend email: ${resend ? "enabled" : "disabled (set RESEND_API_KEY)"}`);
  console.log(`\n📱 Customer page: http://localhost:${PORT}/customer.html`);
  console.log(`👨‍🍳 Chef dashboard: http://localhost:${PORT}/chef.html`);
});
