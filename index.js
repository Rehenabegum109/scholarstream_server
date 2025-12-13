
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const admin = require('firebase-admin');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const app = express();

// Firebase Admin
const serviceAccount = require('./firebase_admin.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));


const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    try {
        const idToken = token.split(' ')[1];
        const decoded = await admin.auth().verifyIdToken(idToken);
        console.log('decoded in the token', decoded);
        req.decoded_email = decoded.email;
        next();
    }
    catch (err) {
        return res.status(401).send({ message: 'unauthorized access' })
    }


}
app.use(express.json());




// MongoDB client
const client = new MongoClient(process.env.MONGO_URL, {
  serverApi: { version: ServerApiVersion.v1 }
});


async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected");

    const db = client.db("scholarstream");
    usersCollection = db.collection("users");
    scholarshipsCollection = db.collection("scholarships");
    reviewsCollection = db.collection("reviews");
    applicationsCollection = db.collection("applications");




const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;  

  const user = await usersCollection.findOne({ email });

  if (!user || user.role !== "Admin") {  
    return res.status(403).send({ message: "forbidden access" });
  }

  next();
};

    // ===============================
    // Stripe Checkout Session Route
    // ===============================
 
// app.post("/create-checkout-session", async (req, res) => {
//   const { scholarshipId, studentEmail, amount } = req.body;

//   try {
//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
      
//       line_items: [
//         {
//           price_data: {
//             currency: "usd",
//             product_data: { name: "Scholarship Application Fee" },
//             unit_amount: amount * 100,
//           },
//           quantity: 1,
//         },
//       ],
      
//       mode: "payment",
//       success_url:`http://localhost:5173/payment-success?scholarshipId=${scholarshipId}&email=${userEmail}`,
//       

//       cancel_url: "http://localhost:5173/payment-cancel",
//       // cancel_url: `http://localhost:5173/my-applications?payment=cancel&applicationId=${app._id}`,
//             Student_email: studentEmail, 
//       metadata: { applicationId },
//     });

//     res.json({ url: session.url });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });


// app.post("/create-checkout-session", async (req, res) => {
//   const { scholarshipId, studentEmail, applicationId, amount } = req.body;

//   if (!scholarshipId || !studentEmail || !applicationId || !amount)
//     return res.status(400).json({ message: "Missing fields" });

//   if (typeof amount !== "number" || amount <= 0) {
//     return res.status(400).json({ message: "Invalid amount" });
//   }

//   try {
//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       line_items: [{
//         price_data: {
//           currency: "usd",
//           product_data: { name: "Scholarship Application Fee" },
//           unit_amount: amount * 100,
//         },
//         quantity: 1,
//       }],
//       mode: "payment",
//       success_url: `http://localhost:5173/payment-success?applicationId=${applicationId}&email=${studentEmail}`,
//       cancel_url: `http://localhost:5173/payment-cancel?applicationId=${applicationId}&email=${studentEmail}`,
//       metadata: { scholarshipId, studentEmail, applicationId },
//     });

//     res.json({ url: session.url });
//   } catch (err) {
//     console.error("Stripe checkout error:", err);
//     res.status(500).json({ message: "Failed to create Stripe session", error: err.message });
//   }
// });

app.post("/create-checkout-session", async (req, res) => {
  const { scholarshipId, studentEmail, applicationId, amount } = req.body;

  if (!scholarshipId || !studentEmail || !applicationId || !amount) {
    return res.status(400).json({ message: "Missing fields" });
  }

  if (typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Scholarship Application Fee",
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],

      success_url: `http://localhost:5173/payment-success?applicationId=${applicationId}`,
      cancel_url: `http://localhost:5173/payment-cancel?applicationId=${applicationId}`,

      metadata: {
        applicationId,
        scholarshipId,
        studentEmail,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ message: "Stripe session failed" });
  }
});

// app.post("/update-payment-status", async (req, res) => 

//   { const { applicationId, paymentStatus } = req.body;
//  if (!ObjectId.isValid(applicationId)) 
//   return res.status(400).json({ message: "Invalid ID" });
//  try { const statusUpdate = paymentStatus === "paid" ? "completed" : "pending";
//    const result = await applicationsCollection.updateOne( { _id: new ObjectId(applicationId) }, 
//    { $set: { paymentStatus, applicationStatus: statusUpdate } } ); 
//    res.json({ success: true, modifiedCount: result.modifiedCount })
//    } catch (err) { console.error(err); res.status(500).json({ message: "Failed to update payment status" }) } });

// app.post("/create-checkout-session", async (req, res) => {
//   const { scholarshipId, studentEmail, applicationId, amount } = req.body;

//   try {
//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ["card"],
//       line_items: [
//         {
//           price_data: {
//             currency: "usd",
//             product_data: { name: "Scholarship Application Fee" },
//             unit_amount: amount * 100,
//           },
//           quantity: 1,
//         },
//       ],
//       mode: "payment",
//       success_url: `http://localhost:5173/payment-success?applicationId=${applicationId}&email=${studentEmail}`,
//       cancel_url: `http://localhost:5173/payment-cancel?applicationId=${applicationId}&email=${studentEmail}`,
//       metadata: { applicationId },
//     });

//     res.json({ url: session.url });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// app.post("/update-payment-status", async (req, res) => {
//   const { applicationId, paymentStatus } = req.body;

//   if (!applicationId || !ObjectId.isValid(applicationId)) {
//     return res.status(400).json({ message: "Invalid application ID" });
//   }

//   try {
//     const statusUpdate = paymentStatus === "paid" ? "completed" : "pending";

//     const result = await applicationsCollection.updateOne(
//       { _id: new ObjectId(applicationId) },
//       { $set: { paymentStatus, applicationStatus: statusUpdate } }
//     );

//     res.json({ success: true, modifiedCount: result.modifiedCount });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to update payment status" });
//   }
// });


// app.post("/update-payment-status", async (req, res) => {
//   const { applicationId, paymentStatus } = req.body;

//   if (!ObjectId.isValid(applicationId)) return res.status(400).json({ message: "Invalid ID" });

//   try {
//     const result = await applicationsCollection.updateOne(
//       { _id: new ObjectId(applicationId) },
//       {
//         $set: {
//           paymentStatus,
//           applicationStatus: paymentStatus === "paid" ? "completed" : "pending",
//         },
//       }
//     );
//     res.json({ success: true, modifiedCount: result.modifiedCount });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to update payment status" });
//   }
// });

// app.post("/update-payment-status", async (req, res) => {
//   const { applicationId, paymentStatus } = req.body;

//   if (!ObjectId.isValid(applicationId)) return res.status(400).json({ message: "Invalid ID" });

//   try {
//     const result = await applicationsCollection.updateOne(
//       { _id: new ObjectId(applicationId) },
//       {
//         $set: {
//           paymentStatus,
//           applicationStatus: paymentStatus === "paid" ? "completed" : "pending",
//         },
//       }
//     );
//     res.json({ success: true, modifiedCount: result.modifiedCount });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to update payment status" });
//   }
// });


// app.post("/update-payment-status", async (req, res) => {
//   const { applicationId, paymentStatus } = req.body;

//   if (!ObjectId.isValid(applicationId)) {
//     return res.status(400).json({ message: "Invalid application ID" });
//   }

//   try {
//     const statusUpdate = paymentStatus === "paid" ? "completed" : "pending";

//     const result = await applicationsCollection.updateOne(
//       { _id: new ObjectId(applicationId) },
//       { $set: { paymentStatus, applicationStatus: statusUpdate } }
//     );

//     res.json({ success: true, modifiedCount: result.modifiedCount });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to update payment status" });
//   }
// });

    //     app.post("/update-payment-status", async (req, res) => {



    //   const { applicationId, paymentStatus } = req.body;

    //   if (!ObjectId.isValid(applicationId)) return res.status(400).json({ message: "Invalid ID" });

    //   try {
    //     const statusUpdate = paymentStatus === "paid" ? "completed" : "pending";

    //     const result = await applicationsCollection.updateOne(
    //       { _id: new ObjectId(applicationId) },
    //       { $set: { paymentStatus, applicationStatus: statusUpdate } }
    //     );

    //     res.json({ success: true, modifiedCount: result.modifiedCount });
    //   } catch (err) {
    //     console.error(err);
    //     res.status(500).json({ message: "Failed to update payment status" });
    //   }
    // });

//     app.post("/update-payment-status", express.raw({ type: "application/json" }), async (req, res) => {
//   const sig = req.headers['stripe-signature'];
//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
//   } catch (err) {
//     console.log("Webhook signature verification failed.", err.message);
//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   // Payment succeeded
//   if (event.type === 'checkout.session.completed') {
//     const session = event.data.object;
//     const applicationId = session.metadata.applicationId;

//     try {
//       await applicationsCollection.updateOne(
//         { _id: new ObjectId(applicationId) },
//         { $set: { paymentStatus: "paid", applicationStatus: "completed" } }
//       );
//       console.log(`Payment updated for application ${applicationId}`);
//     } catch (err) {
//       console.error("Failed to update payment status", err);
//     }
//   }

//   res.json({ received: true });
// });


    // ===============================
    // BASIC ROUTE
    // ===============================
   app.post("/update-payment-status", async (req, res) => {
  const { applicationId } = req.body;

  if (!ObjectId.isValid(applicationId)) {
    return res.status(400).json({ message: "Invalid applicationId" });
  }

  try {
    const result = await applicationsCollection.updateOne(
      { _id: new ObjectId(applicationId) },
      {
        $set: {
          paymentStatus: "paid",
        },
      }
    );

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update payment status" });
  }
});

    app.get("/", (req, res) => res.send("ScholarStream Server Running"));

//     ===============================
// USERS
// ===============================


 app.get('/users', verifyToken,verifyAdmin,async (req, res) => {
            const searchText = req.query.searchText;
            const query = {};

            if (searchText) {
                // query.displayName = {$regex: searchText, $options: 'i'}

                query.$or = [
                    { displayName: { $regex: searchText, $options: 'i' } },
                    { email: { $regex: searchText, $options: 'i' } },
                ]

            }

            const cursor = usersCollection.find(query).sort({ createdAt: -1 }).limit(5);
            const result = await cursor.toArray();
            res.send(result);
        });

        

       
app.get('/users/:email/role',verifyToken,async (req, res) => {
  try {
    const email = req.params.email;
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(404).send({ role: 'Student' });
    res.send({ role: user.role || 'Student' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ role: 'Student' });
  }
});

          app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = 'Student';
            user.createdAt = new Date();
            const email = user.email;
            const userExists = await usersCollection.findOne({ email })

            if (userExists) {
                return res.send({ message: 'user exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        })
       app.patch('/users/:id/role', verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const roleInfo = req.body;
  const query = { _id: new ObjectId(id) }
  const updatedDoc = {
      $set: {
          role: roleInfo.role
      }
  }
  const result = await usersCollection.updateOne(query, updatedDoc)
  res.send(result);
})

// DELETE /users/:id - delete user
app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    res.send({ success: result.deletedCount > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false });
  }
});

// // Get single user info
// app.get("/users/:email", verifyToken, async (req, res) => {
//   const user = await usersCollection.findOne({ email: req.params.email });
//   if (!user) return res.status(404).json({ message: "User not found" });
//   res.json(user);
// });

// // Update role (admin only)
// app.patch("/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
//   const result = await usersCollection.updateOne(
//     { _id: new ObjectId(req.params.id) },
//     { $set: { role: req.body.role } }
//   );
//   res.json(result);
// });

// // Delete user (admin only)
// app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
//   const result = await usersCollection.deleteOne({ _id: new ObjectId(req.params.id) });
//   res.json(result);
// });


    // ===============================
// SCHOLARSHIPS
// ===============================

// Public routes
app.get("/scholarships", async (req, res) => {
  const scholarships = await scholarshipsCollection.find().toArray();
  res.json(scholarships);
});

app.get("/scholarships/:id", async (req, res) => {
  const scholarship = await scholarshipsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!scholarship) return res.status(404).json({ message: "Scholarship not found" });
  res.json(scholarship);
});

 
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
      res.status(404).json({ success: false, message: "Scholarship not found or no changes" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to update scholarship" });
  }
});
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
    userEmail
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

  try {
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

    const result = await scholarshipsCollection.insertOne(scholarship);
    res.json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add scholarship" });
  }
});
// DELETE scholarship
app.delete("/scholarships/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await scholarshipsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: "Scholarship not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to delete scholarship" });
  }
});






// ===============================
// REVIEWS
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
  const result = await reviewsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json(result);
});

// ===============================
// APPLICATIONS
// ===============================

app.post("/applications", async (req, res) => {
  const { scholarshipId, studentEmail, paymentStatus } = req.body;
  if (!scholarshipId || !studentEmail || !paymentStatus)
    return res.status(400).json({ message: "Missing fields" });

  const user = await usersCollection.findOne({ email: studentEmail });
  if (!user) return res.status(404).json({ message: "User not found" });

  const scholarship = await scholarshipsCollection.findOne({ _id: new ObjectId(scholarshipId) });
  if (!scholarship) return res.status(404).json({ message: "Scholarship not found" });

  const existingApplication = await applicationsCollection.findOne({ scholarshipId, studentEmail });
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

// // app.post("/applications", async (req, res) => {
// //   const { scholarshipId, studentEmail, paymentStatus } = req.body;
// //   if (!scholarshipId || !studentEmail || !paymentStatus)
// //     return res.status(400).json({ message: "Missing fields" });

// //   const user = await usersCollection.findOne({ email: studentEmail });
// //   if (!user) return res.status(404).json({ message: "User not found" });

// //   const scholarship = await scholarshipsCollection.findOne({ _id: new ObjectId(scholarshipId) });
// //   if (!scholarship) return res.status(404).json({ message: "Scholarship not found" });

// //   // Duplicate check
// //   const existingApplication = await applicationsCollection.findOne({ scholarshipId, studentEmail });
// //   if (existingApplication)
// //     return res.status(400).json({ message: "Already applied" });

// //   const application = {
// //     scholarshipId,
// //     userId: user._id,
// //     studentEmail, // consistent field
// //     universityName: scholarship.universityName,
// //     scholarshipCategory: scholarship.scholarshipCategory,
// //     degree: scholarship.degree,
// //     applicationFees: scholarship.applicationFees,
// //     serviceCharge: 0,
// //     applicationStatus: paymentStatus === "paid" ? "completed" : "pending",
// //     paymentStatus,
// //     applicationDate: new Date(),
// //   };

// //   const result = await applicationsCollection.insertOne(application);
// //   res.json({ success: true, insertedId: result.insertedId });
// // });


// // Get user applications
// app.get("/applications", async (req, res) => {
//   const email = req.query.email;
//   if (!email) return res.status(400).json({ message: "Email is required" });

//   const apps = await applicationsCollection.find({ userEmail: email }).toArray();
//   res.json(apps);
// });
// // Get all applications for a student
// app.get("/applications/student/:email", async (req, res) => {
//   const email = req.params.email;
//   if (!email) return res.status(400).json({ message: "Email required" });

//   // studentEmail ব্যবহার করুন
//   const apps = await applicationsCollection.find({ studentEmail: email }).toArray();
//   res.json(apps);
// });



// app.get("/applications/check", async (req, res) => {
//   const { scholarshipId, email } = req.query;

//   if (!scholarshipId || !email) {
//     return res.status(400).json({ message: "Missing scholarshipId or email" });
//   }

//   try {
//     const existingApplication = await applicationsCollection.findOne({
//       scholarshipId,
//       studentEmail: email,
//     });
//     res.json({ applied: !!existingApplication });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to check application" });
//   }
// });


// // DELETE /applications/:id
// app.delete("/applications/:id", async (req, res) => {
//   const { id } = req.params;
//   if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid ID" });

//   try {
//     const result = await applicationsCollection.deleteOne({ _id: new ObjectId(id) });
//     res.json({ success: result.deletedCount > 0 });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to delete application" });
//   }
// });



// // Update application (admin/moderator)
// app.patch("/applications/status/:id", async (req, res) => {
//   const { status } = req.body;

//   const result = await applicationsCollection.updateOne(
//     { _id: new ObjectId(req.params.id) },
//     { $set: { applicationStatus: status } }
//   );

//   res.send(result);
// });
// app.patch("/applications/feedback/:id", async (req, res) => {
//   const { feedback } = req.body;

//   const result = await applicationsCollection.updateOne(
//     { _id: new ObjectId(req.params.id) },
//     { $set: { applicationFeedback: feedback } }
//   );

//   res.send(result);
// });
// -------------------- POST APPLICATION --------------------

// -------------------- GET ALL APPLICATIONS --------------------
// For Moderator/Admin
app.get("/applications", async (req, res) => {
  try {
    const apps = await applicationsCollection.find({}).toArray();
    res.json(apps);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch applications" });
  }
});

// -------------------- GET APPLICATIONS FOR A STUDENT --------------------
app.get("/applications/student/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  if (!email) return res.status(400).json({ message: "Email required" });

  try {
    const apps = await applicationsCollection.find({ studentEmail: email }).toArray();
    res.json(apps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch student applications" });
  }
});

// -------------------- CHECK IF STUDENT ALREADY APPLIED --------------------
app.get("/applications/check", async (req, res) => {
  const { scholarshipId, email } = req.query;

  if (!scholarshipId || !email) {
    return res.status(400).json({ message: "Missing scholarshipId or email" });
  }

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



// -------------------- UPDATE APPLICATION FEEDBACK --------------------
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
    // START SERVER
    // ===============================
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  } catch (err) {
    console.log(err);
  }
}

run();