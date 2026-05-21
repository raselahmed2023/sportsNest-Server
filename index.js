const express = require('express')
const dontenv = require('dotenv')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

dontenv.config()

const app = express()
const PORT = process.env.PORT || 8000
const uri = process.env.MONGODB_URI

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())


app.get('/', (req, res) => {
  res.json({ message: 'SportNest server running ' })
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

    app.post('/facilities', async (req, res) => {
      const facilityData = req.body
      const result = await facilitiesCollection.insertOne(facilityData)
      res.json(result)
    })

    app.get('/facilities', async (req, res) => {
      const facilities = await facilitiesCollection.find({}).toArray()
      res.json(facilities)
    })

    app.get('/facility/:id', async (req, res) => {
      const { id } = req.params
      const result = await facilitiesCollection.findOne({ _id: new ObjectId(id) })
      res.json(result)
    })

    // booking data

    app.post('/bookings', async (req, res) => {
      const bookingData = req.body
      const result = await bookingsCollection.insertOne(bookingData)
      res.json(result)
    })

    app.get('/bookings', async (req, res) => {
      const { email } = req.query
      const query = email ? { user_email: email } : {}
      const bookings = await bookingsCollection.find(query).toArray()
      res.json(bookings)
    })

    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    })

    //update and delete manage facilities

    app.get("/facilities", async (req, res) => {
      const email = req.query.email;
      const facilities = await facilitiesCollection.find({ owner_email: email }).toArray();
      res.json(facilities);
    });

    app.delete("/facilities/:id", async (req, res) => {
      const id = req.params.id;
      const result = await facilitiesCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.put("/facilities/:id", async (req, res) => {
      const id = req.params.id;
      const updateData=req.body;
      const result = await facilitiesCollection.updateOne({ _id: new ObjectId(id)},
    {
       $set:updateData
    });
      res.json(result);
    });

  } catch (err) {
    console.error(err)
  }
}

run()

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`)
})