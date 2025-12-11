const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

app.use(express.json());

// MongoDB client
const client = new MongoClient(process.env.MONGO_URL, {
  serverApi: { version: ServerApiVersion.v1 }
});

// Global Collections
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

    // ===============================
    // Stripe Checkout Session Route
    // ===============================
app.post("/create-checkout-session", async (req, res) => {
  const { scholarshipId, userEmail, amount } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Scholarship Application Fee" },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `http://localhost:5173/payment-success?scholarshipId=${scholarshipId}&email=${userEmail}`,
      cancel_url: "http://localhost:5173/payment-cancel",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

    // ===============================
    // BASIC ROUTE
    // ===============================
    app.get("/", (req, res) => res.send("ScholarStream Server Running"));

    // ===============================
    // USERS
    // ===============================
    app.post("/users", async (req, res) => {
      const { name, email, photo, role } = req.body;
      const exists = await usersCollection.findOne({ email });

      if (exists) return res.status(400).json({ message: "User already exists" });

      const newUser = { name, email, photo, role: role || "Admin" };
      const result = await usersCollection.insertOne(newUser);
      res.json(result);
    });

    app.get("/users", async (req, res) => {
  try {
    const users = await usersCollection.find().toArray();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


    app.get("/users/:email", async (req, res) => {
      const user = await usersCollection.findOne({ email: req.params.email });
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    });

    app.patch("/users/:id/role", async (req, res) => {
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role: req.body.role } }
      );
      res.json(result);
    });

    app.delete("/users/:id", async (req, res) => {
      res.json(await usersCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
    });

    // ===============================
    // SCHOLARSHIPS
    // ===============================
    app.get("/scholarships", async (req, res) => {
  try {
    const scholarships = await scholarshipsCollection.find().toArray();
    res.json(scholarships);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

    // Get single scholarship by ID
  app.get("/scholarships/:id", async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid ID" });
    const scholarship = await scholarshipsCollection.findOne({ _id: new ObjectId(id) });
    if (!scholarship) return res.status(404).json({ message: "Scholarship not found" });
    console.log("Searching scholarship for ID:", id);
    res.json(scholarship);
  });

    app.post("/scholarships", async (req, res) => {
      res.json(await scholarshipsCollection.insertOne(req.body));
    });

    app.put("/scholarships/:id", async (req, res) => {
      res.json(
        await scholarshipsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: req.body }
        )
      );
    });

    app.delete("/scholarships/:id", async (req, res) => {
      res.json(await scholarshipsCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
    });

      app.post("/applications", async (req, res) => {
    try {
      const { scholarshipId, email, paymentStatus } = req.body;
      const user = await usersCollection.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      const scholarship = await scholarshipsCollection.findOne({ _id: new ObjectId(scholarshipId) });
      if (!scholarship) return res.status(404).json({ message: "Scholarship not found" });

      const application = {
        scholarshipId,
        userId: user._id,
        userEmail: user.email,
        universityName: scholarship.universityName,
        scholarshipCategory: scholarship.category || "",
        degree: scholarship.degree || "",
        applicationFees: scholarship.applicationFees,
        serviceCharge: 0,
        applicationStatus: paymentStatus === "paid" ? "completed" : "pending",
        paymentStatus,
        applicationDate: new Date(),
        feedback: ""
      };

      const result = await applicationsCollection.insertOne(application);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to save application" });
    }
  });
    // ===============================
    // REVIEWS
    // ===============================
    app.get("/reviews", async (req, res) => {
      const query = req.query.scholarshipId ? { scholarshipId: req.query.scholarshipId } : {};
      res.json(await reviewsCollection.find(query).toArray());
    });

    app.post("/reviews", async (req, res) => {
      const user = await usersCollection.findOne({ email: req.body.email });

      if (!user) return res.status(404).json({ message: "User not found" });

      const review = {
        scholarshipId: req.body.scholarshipId,
        userName: user.name,
        userEmail: user.email,
        ratingPoint: req.body.ratingPoint,
        reviewComment: req.body.reviewComment,
        reviewDate: new Date()
      };

      res.json(await reviewsCollection.insertOne(review));
    });

    app.delete("/reviews/:id", async (req, res) => {
      res.json(await reviewsCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
    });

    // ===============================
    // APPLICATIONS
    // ===============================
    app.post("/applications", async (req, res) => {
      const user = await usersCollection.findOne({ email: req.body.email });
      if (!user) return res.status(404).json({ message: "User not found" });

      const appData = {
        ...req.body,
        userId: user._id,
        applicationDate: new Date(),
        applicationStatus: "pending",
        paymentStatus: "unpaid"
      };

      res.json(await applicationsCollection.insertOne(appData));
    });

    app.get("/applications", async (req, res) => {
      res.json(await applicationsCollection.find().toArray());
    });

    app.put("/applications/:id", async (req, res) => {
      res.json(
        await applicationsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: req.body }
        )
      );
    });

    // ===============================
    // START SERVER
    // ===============================
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  } catch (err) {
    console.log(err);
  }
}

run();
