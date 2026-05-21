const express = require('express')
const jwt = require("jsonwebtoken");
const dotenv = require('dotenv')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 8000
const uri = process.env.MONGODB_URI

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}))

app.use(express.json())


const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Invalid Token" });
    }
    req.user = decoded;
    next();
  });
};


app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(
    user,
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.send({ token });
});

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
      const id = req.params.id
      const result = await facilitiesCollection.findOne({ _id: new ObjectId(id) })
      res.json(result)
    })

   
    app.post('/bookings', async (req, res) => {
      const bookingData = req.body
      const result = await bookingsCollection.insertOne(bookingData)
      res.json(result)
    })


    app.get('/bookings', verifyToken, async (req, res) => {
      const email = req.user.email
      const bookings = await bookingsCollection.find({ user_email: email }).toArray()
      res.json(bookings)
    })


    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id
      const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id)})
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
      const result = await facilitiesCollection.deleteOne({_id: new ObjectId(id),owner_email: email,})
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
  console.log(`Server running on port ${PORT}`)
})