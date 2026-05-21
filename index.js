const express = require('express')
const dotenv = require('dotenv')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 8000
const uri = process.env.MONGODB_URI

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())

// ✅ এটা run() এর বাইরে
app.get('/', (req, res) => {
  res.json({ message: 'SportNest server running ✅' })
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

    app.post('/facilities', async (req, res) => {
      const facilityData = req.body
      const result = await facilitiesCollection.insertOne(facilityData)
      res.json(result)
    })

    app.get('/facilities', async (req, res) => {
      const facilities = await facilitiesCollection.find({}).toArray()
      res.json(facilities)
    })

    console.log('✅ Connected to MongoDB!')

  } catch (err) {
    console.error(err)
  }
}

run()

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})