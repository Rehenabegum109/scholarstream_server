// ===============================
// SERVER SETUP
// ===============================
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

const PORT = process.env.PORT || 3000;
const app = express();

// Firebase Admin
const serviceAccount = require("./firebase_admin.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// ===============================
// MIDDLEWARES
// ===============================
app.use(express.json());

// CORS configuration
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());

// Verify Firebase token
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send({ message: "Unauthorized access" });

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

// ===============================
// MONGODB SETUP
// ===============================
const client = new MongoClient(process.env.MONGO_URL, {
  serverApi: { version: ServerApiVersion.v1 },
});

let usersCollection;
let scholarshipsCollection;
let reviewsCollection;
let applicationsCollection;

// Verify Admin
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded_email;
  const user = await usersCollection.findOne({ email });
  if (!user || user.role !== "Admin") {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

// ===============================
// MAIN RUN FUNCTION
// ===============================
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
    // BASIC ROUTE
    // ===============================
    app.get("/", (req, res) => res.send("ScholarStream Server Running"));

    // ===============================
    // USERS ROUTES
    // ===============================
    // Get all users (Admin only)
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const searchText = req.query.searchText;
      const query = {};
      if (searchText) {
        query.$or = [
          { displayName: { $regex: searchText, $options: "i" } },
          { email: { $regex: searchText, $options: "i" } },
        ];
      }
      const users = await usersCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      res.json(users);
    });

    // Get user role
    app.get("/users/:email/role", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        if (!user) return res.status(404).send({ role: "Student" });
        res.send({ role: user.role || "Student" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ role: "Student" });
      }
    });

    // Add new user
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "Student";
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await usersCollection.findOne({ email });
      if (userExists) return res.send({ message: "User exists" });

      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    // Update user role (Admin only)
    app.patch("/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const roleInfo = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: roleInfo.role } }
      );
      res.json(result);
    });


    // Delete user (Admin only)
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      try {
        const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
        res.json({ success: result.deletedCount > 0 });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
      }
    });

    // ===============================
    // SCHOLARSHIPS ROUTES
    // ===============================
    // Public: Get all scholarships
    app.get("/scholarships", async (req, res) => {
      const scholarships = await scholarshipsCollection.find().toArray();
      res.json(scholarships);
    });

    // Get single scholarship
    app.get("/scholarships/:id", async (req, res) => {
      const scholarship = await scholarshipsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      if (!scholarship)
        return res.status(404).json({ message: "Scholarship not found" });
      res.json(scholarship);
    });

    // Add new scholarship
    app.post("/scholarships", async (req, res) => {
      const {
        scholarshipName,
        universityName,
        universityImage,
        universityCountry,
        universityCity,
        universityWorldRank,
        subjectCategory,
        scholarshipCategory,
        degree,
        tuitionFees,
        applicationFees,
        serviceCharge,
        applicationDeadline,
        scholarshipPostDate,
        userEmail,
      } = req.body;

      if (
        !scholarshipName ||
        !universityName ||
        !universityImage ||
        !universityCountry ||
        !universityCity ||
        !subjectCategory ||
        !scholarshipCategory ||
        !degree ||
        !applicationFees ||
        !serviceCharge ||
        !applicationDeadline ||
        !scholarshipPostDate ||
        !userEmail
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const scholarship = {
        scholarshipName,
        universityName,
        universityImage,
        universityCountry,
        universityCity,
        universityWorldRank,
        subjectCategory,
        scholarshipCategory,
        degree,
        tuitionFees: tuitionFees || 0,
        applicationFees,
        serviceCharge,
        applicationDeadline: new Date(applicationDeadline),
        scholarshipPostDate: new Date(scholarshipPostDate),
        userEmail,
      };

      try {
        const result = await scholarshipsCollection.insertOne(scholarship);
        res.json({ success: true, insertedId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to add scholarship" });
      }
    });

    // Update scholarship
    app.patch("/scholarships/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      try {
        const result = await scholarshipsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        if (result.modifiedCount > 0) {
          res.json({ success: true });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Scholarship not found or no changes" });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update scholarship" });
      }
    });

    // Delete scholarship
    app.delete("/scholarships/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await scholarshipsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount > 0) res.json({ success: true });
        else res.status(404).json({ success: false, message: "Scholarship not found" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to delete scholarship" });
      }
    });

    // ===============================
    // REVIEWS ROUTES
    // ===============================
    // Public fetch
    app.get("/reviews", async (req, res) => {
      const query = {};
      if (req.query.scholarshipId) query.scholarshipId = req.query.scholarshipId;
      const reviews = await reviewsCollection.find(query).toArray();
      res.json(reviews);
    });

    // Add review (authenticated users)
    app.post("/reviews", async (req, res) => {
      const { scholarshipId, email, ratingPoint, reviewComment } = req.body;
      const user = await usersCollection.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      const review = {
        scholarshipId,
        userName: user.name,
        userEmail: user.email,
        ratingPoint,
        reviewComment,
        reviewDate: new Date(),
      };

      const result = await reviewsCollection.insertOne(review);
      res.json(result);
    });

    // Delete review (moderator/admin)
    app.delete("/reviews/:id", async (req, res) => {
      const result = await reviewsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.json(result);
    });

    // ===============================
    // APPLICATIONS ROUTES
    // ===============================
    // Add application
    app.post("/applications", async (req, res) => {
      const { scholarshipId, studentEmail, paymentStatus } = req.body;
      if (!scholarshipId || !studentEmail || !paymentStatus)
        return res.status(400).json({ message: "Missing fields" });

      const user = await usersCollection.findOne({ email: studentEmail });
      if (!user) return res.status(404).json({ message: "User not found" });

      const scholarship = await scholarshipsCollection.findOne({
        _id: new ObjectId(scholarshipId),
      });
      if (!scholarship) return res.status(404).json({ message: "Scholarship not found" });

      const existingApplication = await applicationsCollection.findOne({
        scholarshipId,
        studentEmail,
      });
      if (existingApplication)
        return res.status(400).json({ message: "Already applied" });

      const application = {
        scholarshipId,
        userId: user._id,
        studentEmail,
        universityName: scholarship.universityName,
        scholarshipCategory: scholarship.scholarshipCategory,
        degree: scholarship.degree,
        applicationFees: scholarship.applicationFees,
        serviceCharge: 0,
        applicationStatus: paymentStatus === "paid" ? "completed" : "pending",
        paymentStatus,
        applicationDate: new Date(),
      };

      const result = await applicationsCollection.insertOne(application);
      res.json({ success: true, insertedId: result.insertedId });
    });

    // Get all applications (Admin)
    app.get("/applications", async (req, res) => {
      try {
        const apps = await applicationsCollection.find({}).toArray();
        res.json(apps);
      } catch (err) {
        res.status(500).json({ message: "Failed to fetch applications" });
      }
    });

    // Get applications for a student
    app.get("/applications/student/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      try {
        const apps = await applicationsCollection.find({ studentEmail: email }).toArray();
        res.json(apps);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch student applications" });
      }
    });

    // Check if student already applied
    app.get("/applications/check", async (req, res) => {
      const { scholarshipId, email } = req.query;
      if (!scholarshipId || !email)
        return res.status(400).json({ message: "Missing scholarshipId or email" });

      try {
        const existingApplication = await applicationsCollection.findOne({
          scholarshipId,
          studentEmail: email,
        });
        res.json({ applied: !!existingApplication });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to check application" });
      }
    });

    // Update application status & feedback
    app.patch("/applications/:id", async (req, res) => {
      const { status, feedback } = req.body;
      const { id } = req.params;
      try {
        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { applicationStatus: status, applicationFeedback: feedback } }
        );
        res.json({ success: true, modifiedCount: result.modifiedCount });
      } catch (err) {
        res.status(500).json({ message: "Failed to update application" });
      }
    });

    // Cancel application (soft delete)
    app.delete("/applications/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { applicationStatus: "rejected" } }
        );
        res.json({ success: true, modifiedCount: result.modifiedCount });
      } catch (err) {
        res.status(500).json({ message: "Failed to cancel application" });
      }
    });

    // Update feedback
    app.patch("/applications/feedback/:id", verifyToken, async (req, res) => {
      const { feedback } = req.body;
      try {
        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { applicationFeedback: feedback } }
        );
        res.json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update feedback" });
      }
    });

    // ===============================
    // STRIPE CHECKOUT
    // ===============================
    app.post("/create-checkout-session", async (req, res) => {
      const { scholarshipId, studentEmail, applicationId, amount } = req.body;
      if (!scholarshipId || !studentEmail || !applicationId || !amount)
        return res.status(400).json({ message: "Missing fields" });

      if (typeof amount !== "number" || amount <= 0)
        return res.status(400).json({ message: "Invalid amount" });

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
          success_url: `http://localhost:5173/payment-success?applicationId=${applicationId}`,
          cancel_url: `http://localhost:5173/payment-cancel?applicationId=${applicationId}`,
          metadata: { applicationId, scholarshipId, studentEmail },
        });

        res.json({ url: session.url });
      } catch (err) {
        console.error("Stripe error:", err);
        res.status(500).json({ message: "Stripe session failed" });
      }
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
