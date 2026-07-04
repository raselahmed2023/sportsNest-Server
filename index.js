const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const uri = process.env.MONGODB_URI;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

let JWKS;

async function initJose() {
  const jose = await import("jose");

  JWKS = jose.createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
  );
}

initJose();

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  if (req.cookies?.token) {
    return req.cookies.token;
  }

  return null;
};

const verifyToken = async (req, res, next) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const jose = await import("jose");
    const { payload } = await jose.jwtVerify(token, JWKS);

    req.user = payload;
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return res.status(401).json({ message: "Invalid Token" });
  }
};

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
  }

  const db = client.db("sportsNest");

  return {
    facilitiesCollection: db.collection("facilities"),
    bookingsCollection: db.collection("bookings"),
  };
}

const isValidObjectId = (id) => ObjectId.isValid(id);

app.get("/", (req, res) => {
  res.json({
    message: "SportNest server running",
    status: "healthy",
  });
});

// Public: all facilities with search and filter
app.get("/facilities", async (req, res) => {
  try {
    const { facilitiesCollection } = await connectDB();
    const { search, type } = req.query;

    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (type) {
      const types = type.split(",").map((item) => item.trim().toLowerCase());
      query.facility_type = { $in: types };
    }

    const facilities = await facilitiesCollection
      .find(query)
      .sort({ booking_count: -1, name: 1 })
      .toArray();

    res.json(facilities);
  } catch (error) {
    console.error("Failed to load facilities:", error);
    res.status(500).json({ message: "Failed to load facilities" });
  }
});

// Public: single facility
app.get("/facility/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid facility id" });
    }

    const { facilitiesCollection } = await connectDB();

    const facility = await facilitiesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!facility) {
      return res.status(404).json({ message: "Facility not found" });
    }

    res.json(facility);
  } catch (error) {
    console.error("Failed to load facility:", error);
    res.status(500).json({ message: "Failed to load facility" });
  }
});

// Private: create facility
app.post("/facilities", verifyToken, async (req, res) => {
  try {
    const { facilitiesCollection } = await connectDB();

    const facility = {
      name: req.body.name,
      facility_type: req.body.facility_type,
      image: req.body.image,
      location: req.body.location,
      price_per_hour: Number(req.body.price_per_hour),
      capacity: Number(req.body.capacity),
      available_slots: Array.isArray(req.body.available_slots)
        ? req.body.available_slots
        : [],
      description: req.body.description,
      owner_email: req.user.email,
      booking_count: 0,
      created_at: new Date(),
    };

    const result = await facilitiesCollection.insertOne(facility);

    res.json(result);
  } catch (error) {
    console.error("Failed to create facility:", error);
    res.status(500).json({ message: "Failed to create facility" });
  }
});

// Private: update own facility
app.put("/facilities/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid facility id" });
    }

    const { facilitiesCollection } = await connectDB();

    const updatedFacility = {
      name: req.body.name,
      facility_type: req.body.facility_type,
      image: req.body.image,
      location: req.body.location,
      price_per_hour: Number(req.body.price_per_hour),
      capacity: Number(req.body.capacity),
      description: req.body.description,
      updated_at: new Date(),
    };

    if (Array.isArray(req.body.available_slots)) {
      updatedFacility.available_slots = req.body.available_slots;
    }

    const result = await facilitiesCollection.updateOne(
      {
        _id: new ObjectId(id),
        owner_email: req.user.email,
      },
      {
        $set: updatedFacility,
      }
    );

    res.json(result);
  } catch (error) {
    console.error("Failed to update facility:", error);
    res.status(500).json({ message: "Failed to update facility" });
  }
});

// Private: delete own facility
app.delete("/facilities/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid facility id" });
    }

    const { facilitiesCollection } = await connectDB();

    const result = await facilitiesCollection.deleteOne({
      _id: new ObjectId(id),
      owner_email: req.user.email,
    });

    res.json(result);
  } catch (error) {
    console.error("Failed to delete facility:", error);
    res.status(500).json({ message: "Failed to delete facility" });
  }
});

// Private: get logged-in user's facilities
app.get("/my-facilities", verifyToken, async (req, res) => {
  try {
    const { facilitiesCollection } = await connectDB();

    const facilities = await facilitiesCollection
      .find({ owner_email: req.user.email })
      .sort({ created_at: -1 })
      .toArray();

    res.json(facilities);
  } catch (error) {
    console.error("Failed to load my facilities:", error);
    res.status(500).json({ message: "Failed to load your facilities" });
  }
});

// Private: create booking
app.post("/bookings", verifyToken, async (req, res) => {
  try {
    const { bookingsCollection, facilitiesCollection } = await connectDB();

    const facilityId = req.body.facility_id;

    if (!isValidObjectId(facilityId)) {
      return res.status(400).json({ message: "Invalid facility id" });
    }

    const facility = await facilitiesCollection.findOne({
      _id: new ObjectId(facilityId),
    });

    if (!facility) {
      return res.status(404).json({ message: "Facility not found" });
    }

    const booking = {
      facility_id: facilityId,
      facility_name: facility.name,
      user_email: req.user.email,
      booking_date: req.body.booking_date,
      time_slot: req.body.time_slot,
      hours: Number(req.body.hours),
      total_price: Number(req.body.total_price),
      status: "pending",
      created_at: new Date(),
    };

    const result = await bookingsCollection.insertOne(booking);

    await facilitiesCollection.updateOne(
      { _id: new ObjectId(facilityId) },
      { $inc: { booking_count: 1 } }
    );

    res.json(result);
  } catch (error) {
    console.error("Failed to create booking:", error);
    res.status(500).json({ message: "Failed to create booking" });
  }
});

// Private: get logged-in user's bookings
app.get("/bookings", verifyToken, async (req, res) => {
  try {
    const { bookingsCollection } = await connectDB();

    const bookings = await bookingsCollection
      .find({ user_email: req.user.email })
      .sort({ created_at: -1 })
      .toArray();

    res.json(bookings);
  } catch (error) {
    console.error("Failed to load bookings:", error);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

// Private: cancel/delete own booking
app.delete("/bookings/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid booking id" });
    }

    const { bookingsCollection, facilitiesCollection } = await connectDB();

    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(id),
      user_email: req.user.email,
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const result = await bookingsCollection.deleteOne({
      _id: new ObjectId(id),
      user_email: req.user.email,
    });

    if (result.deletedCount > 0 && isValidObjectId(booking.facility_id)) {
      await facilitiesCollection.updateOne(
        { _id: new ObjectId(booking.facility_id) },
        { $inc: { booking_count: -1 } }
      );
    }

    res.json(result);
  } catch (error) {
    console.error("Failed to cancel booking:", error);
    res.status(500).json({ message: "Failed to cancel booking" });
  }
});

const port = process.env.PORT;

app.listen(port, () => {
  console.log(`SportNest server running on port ${port}`);
});

module.exports = app;