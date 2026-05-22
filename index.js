const express = require('express')
const auth = require("./auth")
const dotenv = require('dotenv')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 8000
const uri = process.env.MONGODB_URI

app.use(
  cors({
    origin: [
      "https://sports-nest-gules.vercel.app",
      "http://localhost:3000",
    ],
    credentials: true,
  })
)

app.use(express.json())

app.all("/api/auth/*", async (req, res) => {
  return auth.handler(req, res)
})


let createRemoteJWKSet
let jwtVerify
let JWKS

async function initJose() {
  const jose = await import("jose")

  createRemoteJWKSet = jose.createRemoteJWKSet
  jwtVerify = jose.jwtVerify

  JWKS = createRemoteJWKSet(
    new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
  )
}

initJose()

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send({ message: "Unauthorized" });
  const token = authHeader.split(" ")[1];
  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Invalid Token" });
  }
};


app.get('/', (req, res) => {
  res.json({ message: 'SportNest server running' })
})

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})

async function run() {

  try {
    await client.connect()
    const db = client.db('sportsNest')
    const facilitiesCollection = db.collection('facilities')
    const bookingsCollection = db.collection('bookings')


    app.post('/facilities', verifyToken, async (req, res) => {
      const facilityData = req.body
      const result = await facilitiesCollection.insertOne(facilityData)
      res.json(result)
    })


    app.get('/facilities', async (req, res) => {
      const facilities = await facilitiesCollection.find({}).toArray()
      res.json(facilities)
    })


    app.get('/facility/:id', async (req, res) => {
      const id = req.params.id
      const result = await facilitiesCollection.findOne({ _id: new ObjectId(id) })
      res.json(result)
    })


    app.post('/bookings', verifyToken, async (req, res) => {
      const bookingData = req.body
      const result = await bookingsCollection.insertOne(bookingData)
      res.json(result)
    })


    app.get('/bookings', verifyToken, async (req, res) => {
      const email = req.user.email
      const bookings = await bookingsCollection.find({ user_email: email }).toArray()
      res.json(bookings)
    })


    app.delete('/bookings/:id', verifyToken, async (req, res) => {
      const email = req.user.email
      const id = req.params.id
      const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) })
      res.json(result)
    })


    app.get("/my-facilities", verifyToken, async (req, res) => {
      const email = req.user.email
      const facilities = await facilitiesCollection.find({ owner_email: email }).toArray()
      res.json(facilities)
    })


    app.delete("/facilities/:id", verifyToken, async (req, res) => {
      const email = req.user.email
      const id = req.params.id
      const result = await facilitiesCollection.deleteOne({ _id: new ObjectId(id), owner_email: email, })
      res.json(result)
    })


    app.put("/facilities/:id", verifyToken, async (req, res) => {
      const email = req.user.email
      const id = req.params.id
      const updateData = req.body

      const result = await facilitiesCollection.updateOne(
        {
          _id: new ObjectId(id),
          owner_email: email,
        },
        {
          $set: updateData,
        }
      )
      res.json(result)
    })
    console.log("MongoDB Connected")
  } catch (err) {
    console.error(err)
  }
}
run()
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
module.exports = app