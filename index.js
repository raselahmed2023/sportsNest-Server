const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

dotenv.config()

const app = express()
const uri = process.env.MONGODB_URI

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}))

app.use(express.json())


let JWKS
async function initJose() {
  const jose = await import("jose")
  JWKS = jose.createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
  )
}
initJose()

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ message: "Unauthorized" })
  const token = authHeader.split(" ")[1]
  try {
    const jose = await import("jose")
    const { payload } = await jose.jwtVerify(token, JWKS)
    req.user = payload
    next()
  } catch (err) {
    return res.status(401).json({ message: "Invalid Token" })
  }
}


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})

let isConnected = false

async function connectDB() {
  if (!isConnected) {
    await client.connect()
    isConnected = true
  }
  return {
    facilitiesCollection: client.db('sportsNest').collection('facilities'),
    bookingsCollection: client.db('sportsNest').collection('bookings'),
  }
}

app.get('/', (req, res) => {
  res.json({ message: 'SportNest server running' })
})

app.get('/facilities', async (req, res) => {
  const { facilitiesCollection } = await connectDB()
  const facilities = await facilitiesCollection.find({}).toArray()
  res.json(facilities)
})

app.get('/facility/:id', async (req, res) => {
  const { facilitiesCollection } = await connectDB()
  const result = await facilitiesCollection.findOne({ _id: new ObjectId(req.params.id) })
  res.json(result)
})

app.post('/facilities', verifyToken, async (req, res) => {
  const { facilitiesCollection } = await connectDB()
  const result = await facilitiesCollection.insertOne(req.body)
  res.json(result)
})

app.put('/facilities/:id', verifyToken, async (req, res) => {
  const { facilitiesCollection } = await connectDB()
  const result = await facilitiesCollection.updateOne(
    { _id: new ObjectId(req.params.id), owner_email: req.user.email },
    { $set: req.body }
  )
  res.json(result)
})

app.delete('/facilities/:id', verifyToken, async (req, res) => {
  const { facilitiesCollection } = await connectDB()
  const result = await facilitiesCollection.deleteOne(
    { _id: new ObjectId(req.params.id), owner_email: req.user.email }
  )
  res.json(result)
})

app.get('/my-facilities', verifyToken, async (req, res) => {
  const { facilitiesCollection } = await connectDB()
  const facilities = await facilitiesCollection.find({ owner_email: req.user.email }).toArray()
  res.json(facilities)
})

app.post('/bookings', verifyToken, async (req, res) => {
  const { bookingsCollection } = await connectDB()
  const result = await bookingsCollection.insertOne(req.body)
  res.json(result)
})

app.get('/bookings', verifyToken, async (req, res) => {
  const { bookingsCollection } = await connectDB()
  const bookings = await bookingsCollection.find({ user_email: req.user.email }).toArray()
  res.json(bookings)
})

app.delete('/bookings/:id', verifyToken, async (req, res) => {
  const { bookingsCollection } = await connectDB()
  const result = await bookingsCollection.deleteOne({ _id: new ObjectId(req.params.id) })
  res.json(result)
})

module.exports = app