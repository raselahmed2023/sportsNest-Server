
const { betterAuth } = require("better-auth")
const { mongodbAdapter } = require("better-auth/adapters/mongodb")
const { MongoClient } = require("mongodb")

const client = new MongoClient(process.env.MONGODB_URI)

const auth = betterAuth({
  database: mongodbAdapter(client.db("sportsNest")),

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  trustedOrigins: [
    "http://localhost:3000",
    "https://sports-nest-gules.vercel.app",
  ],
})

module.exports = auth

