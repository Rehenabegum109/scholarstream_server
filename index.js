const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const bcrypt = require("bcrypt");

const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Client
const client = new MongoClient(process.env.MONGO_URL, {
  serverApi: { version: ServerApiVersion.v1 }
});

let usersCollection, scholarshipsCollection, reviewsCollection, applicationsCollection;

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected");

    const db = client.db("scholarstream");
    usersCollection = db.collection("users");
    scholarshipsCollection = db.collection("scholarships");
    reviewsCollection = db.collection("reviews");
    applicationsCollection = db.collection("applications");

    // ===== Routes =====
    app.get("/", (req, res) => res.send("ScholarStream Server Running"));

 
    // / ===== Users =====
    // Register user
    app.post("/users", async (req, res) => {
      const { name, email, photo, role } = req.body;
      const existing = await usersCollection.findOne({ email });
      if (existing) return res.status(400).json({ message: "User exists" });

      const newUser = { name, email, photo, role: role || "Student" };
      const result = await usersCollection.insertOne(newUser);
      res.json(result);
    });

    // Get all users
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.json(users);
    });

    // Update role
    app.patch("/users/:id/role", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;
      await usersCollection.updateOne({ _id: new ObjectId(id) }, { $set: { role } });
      res.json({ message: "Role updated" });
    });

    // Get user by email
app.get("/users/:email", async (req, res) => {
  const { email } = req.params;
  const user = await usersCollection.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});
    // Delete user
    app.delete("/users/:id", async (req, res) => {
      const { id } = req.params;
      await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.json({ message: "User deleted" });
    });

    // ===== Scholarships =====
    // Get all scholarships
    app.get("/scholarships", async (req, res) => {
      const scholarships = await scholarshipsCollection.find().toArray();
      res.json(scholarships);
    });

    // Add scholarship
    app.post("/scholarships", async (req, res) => {
      const result = await scholarshipsCollection.insertOne(req.body);
      res.status(201).json(result);
    });

    // Update scholarship
    app.put("/scholarships/:id", async (req, res) => {
      const result = await scholarshipsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.json(result);
    });

    // Delete scholarship
    app.delete("/scholarships/:id", async (req, res) => {
      const result = await scholarshipsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.json(result);
    });

    // ===== Reviews =====
    app.post("/reviews", async (req, res) => {
      const user = await usersCollection.findOne({ email: req.body.email });
      const review = {
        scholarshipId: req.body.scholarshipId,
        userName: user?.name || "Anonymous",
        userEmail: user?.email || "Anonymous",
        ratingPoint: req.body.ratingPoint,
        reviewComment: req.body.reviewComment,
        reviewDate: new Date()
      };
      const result = await reviewsCollection.insertOne(review);
      res.status(201).json(result);
    });

    app.get("/reviews", async (req, res) => {
      const { scholarshipId } = req.query;
      if (!scholarshipId) return res.status(400).json({ message: "scholarshipId required" });
      const reviews = await reviewsCollection.find({ scholarshipId }).toArray();
      res.json(reviews);
    });

    // ===== Applications =====
    app.post("/applications", async (req, res) => {
      const user = await usersCollection.findOne({ email: req.body.email });
      const application = {
        ...req.body,
        userId: user?._id,
        userEmail: user?.email,
        applicationDate: new Date(),
        applicationStatus: "pending",
        paymentStatus: "unpaid"
      };
      const result = await applicationsCollection.insertOne(application);
      res.status(201).json(result);
    });

    app.get("/applications", async (req, res) => {
      const applications = await applicationsCollection.find().toArray();
      res.json(applications);
    });

    app.put("/applications/:id", async (req, res) => {
      const result = await applicationsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.json(result);
    });

  } catch (err) {
    console.log(err);
  }
}

run().catch(console.dir);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
