// ===============================
// SERVER SETUP
// ===============================
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const admin = require('firebase-admin')

const PORT = process.env.PORT || 3000
const app = express()

// Firebase Admin Initialization
const serviceAccount = require('./firebase_admin.json')
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })

// ===============================
// MIDDLEWARES
// ===============================
app.use(express.json())
app.use(
	cors({
		origin: [
			'http://localhost:5173',
			'https://stellar-panda-a9ac66.netlify.app',
		],
		credentials: true,
	}),
)

// ===============================
// VERIFY TOKEN (Firebase)
// ===============================
const verifyToken = async (req, res, next) => {
	const authHeader = req.headers.authorization
	if (!authHeader)
		return res.status(401).json({ message: 'Unauthorized access' })

	try {
		const token = authHeader.split(' ')[1]
		const decoded = await admin.auth().verifyIdToken(token)
		req.user = decoded
		next()
	} catch (err) {
		console.error('Token verification failed:', err)
		res.status(401).json({ message: 'Unauthorized access' })
	}
}

// ===============================
// ROLE MIDDLEWARES
// ===============================
let usersCollection // used in middlewares

const verifyAdmin = async (req, res, next) => {
	const email = req.user.email
	const user = await usersCollection.findOne({ email })
	if (!user || user.role !== 'Admin') {
		return res.status(403).json({ message: 'Forbidden access' })
	}
	next()
}

const verifyModerator = async (req, res, next) => {
	const email = req.user.email
	const user = await usersCollection.findOne({ email })
	if (!user || (user.role !== 'Moderator' && user.role !== 'Admin')) {
		return res.status(403).json({ message: 'Forbidden access' })
	}
	next()
}

// ===============================
// MONGODB SETUP
// ===============================
const client = new MongoClient(process.env.MONGO_URL, {
	serverApi: { version: ServerApiVersion.v1 },
})

let scholarshipsCollection
let reviewsCollection
let applicationsCollection

// ===============================
// MAIN RUN FUNCTION
// ===============================
async function run() {
	try {
		// await client.connect();
		console.log('MongoDB Connected')

		const db = client.db('scholarstream')
		 usersCollection = db.collection('users')
		 scholarshipsCollection = db.collection('scholarships')
		 reviewsCollection = db.collection('reviews')
		 applicationsCollection = db.collection('applications')

		// ===============================
		// USERS ROUTES
		// ===============================
		app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
			const searchText = req.query.searchText
			const query = {}
			if (searchText) {
				query.$or = [
					{ displayName: { $regex: searchText, $options: 'i' } },
					{ email: { $regex: searchText, $options: 'i' } },
				]
			}
			const users = await usersCollection
				.find(query)
				.sort({ createdAt: -1 })
				.toArray()
			res.json(users)
		})

		app.get('/users/:email/role',async (req, res) => {
			const email = decodeURIComponent(req.params.email)
			const user = await usersCollection.findOne({ email })
			if (!user) return res.status(404).json({ role: 'Student' })
			res.json({ role: user.role || 'Student' })
		})
		
		app.post('/users', async (req, res) => {
			const user = req.body
			user.role = 'Student'
			user.createdAt = new Date()
			const userExists = await usersCollection.findOne({ email: user.email })
			if (userExists) return res.json({ message: 'User exists' })
			const result = await usersCollection.insertOne(user)
			res.json(result)
		})

		app.patch('/users/:id/role', verifyToken, verifyAdmin, async (req, res) => {
			const id = req.params.id
			const { role } = req.body
			const result = await usersCollection.updateOne(
				{ _id: new ObjectId(id) },
				{ $set: { role } },
			)
			res.json(result)
		})

		app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
			const { id } = req.params
			try {
				const result = await usersCollection.deleteOne({
					_id: new ObjectId(id),
				})
				res.json({ success: result.deletedCount > 0 })
			} catch (err) {
				console.error(err)
				res.status(500).json({ success: false })
			}
		})

		// ===============================
		// SCHOLARSHIPS ROUTES
		// ===============================
		app.get('/scholarships', async (req, res) => {
			try {
				let { page = 1, limit } = req.query
				page = parseInt(page) || 1
				limit = limit ? parseInt(limit) : 0

				const skip = (page - 1) * limit
				const cursor = scholarshipsCollection.find({})
				if (limit > 0) cursor.skip(skip).limit(limit)

				const scholarships = await cursor.toArray()
				const total = await scholarshipsCollection.countDocuments({})
				res.json({ scholarships, total })
			} catch (err) {
				console.error('Error fetching scholarships:', err)
				res.status(500).json({ message: 'Failed to fetch scholarships' })
			}
		})

		app.get('/scholarships/:id', async (req, res) => {
			const scholarship = await scholarshipsCollection.findOne({
				_id: new ObjectId(req.params.id),
			})
			if (!scholarship)
				return res.status(404).json({ message: 'Scholarship not found' })
			res.json(scholarship)
		})

		app.post('/scholarships', verifyToken, verifyAdmin, async (req, res) => {
			const data = req.body
			data.tuitionFees = data.tuitionFees || 0
			data.applicationDeadline = new Date(data.applicationDeadline)
			data.scholarshipPostDate = new Date(data.scholarshipPostDate)

			try {
				const result = await scholarshipsCollection.insertOne(data)
				res.json({ success: true, insertedId: result.insertedId })
			} catch (err) {
				console.error(err)
				res.status(500).json({ message: 'Failed to add scholarship' })
			}
		})

		app.patch(
			'/scholarships/:id',
			verifyToken,
			verifyAdmin,
			async (req, res) => {
				const id = req.params.id
				try {
					const result = await scholarshipsCollection.updateOne(
						{ _id: new ObjectId(id) },
						{ $set: req.body },
					)
					if (result.modifiedCount > 0) res.json({ success: true })
					else
						res.status(404).json({
							success: false,
							message: 'Scholarship not found or no changes',
						})
				} catch (err) {
					console.error(err)
					res.status(500).json({ success: false })
				}
			},
		)

		app.delete(
			'/scholarships/:id',
			verifyToken,
			verifyAdmin,
			async (req, res) => {
				const id = req.params.id
				try {
					const result = await scholarshipsCollection.deleteOne({
						_id: new ObjectId(id),
					})
					if (result.deletedCount > 0) res.json({ success: true })
					else
						res
							.status(404)
							.json({ success: false, message: 'Scholarship not found' })
				} catch (err) {
					console.error(err)
					res.status(500).json({ success: false })
				}
			},
		)

		// ===============================
		// REVIEWS ROUTES
		// ===============================
		app.get('/reviews', async (req, res) => {
			const query = {}
			if (req.query.scholarshipId) query.scholarshipId = req.query.scholarshipId
			const reviews = await reviewsCollection.find(query).toArray()
			res.json(reviews)
		})
		app.patch('/reviews/:id', verifyToken, async (req, res) => {
			const { id } = req.params
			const { reviewComment, ratingPoint } = req.body
			try {
				const result = await reviewsCollection.updateOne(
					{ _id: new ObjectId(id) },
					{ $set: { reviewComment, ratingPoint } },
				)
				if (result.modifiedCount > 0) res.json({ success: true })
				else res.status(404).json({ success: false, message: 'Not updated' })
			} catch (err) {
				res.status(500).json({ success: false, message: 'Server error' })
			}
		})

		app.post('/reviews', verifyToken, async (req, res) => {
			const { scholarshipId, ratingPoint, reviewComment } = req.body
			const email = req.user.email
			const user = await usersCollection.findOne({ email })
			if (!user)
				return res
					.status(404)
					.json({ success: false, message: 'User not found' })

			const review = {
				scholarshipId,
				userName: user.name,
				userEmail: email,
				ratingPoint,
				reviewComment,
				reviewDate: new Date(),
			}

			const result = await reviewsCollection.insertOne(review)

			//  Backend now returns success and review object
			if (result.acknowledged) {
				res.json({
					success: true,
					review: { _id: result.insertedId, ...review },
				})
			} else {
				res
					.status(500)
					.json({ success: false, message: 'Failed to insert review' })
			}
		})

		app.delete('/reviews/:id', verifyToken, async (req, res) => {
			const result = await reviewsCollection.deleteOne({
				_id: new ObjectId(req.params.id),
			})
			res.json(result)
		})

		// ===============================
		// APPLICATIONS ROUTES
		// ===============================
		app.post('/applications', verifyToken, async (req, res) => {
			try {
				const { scholarshipId, paymentStatus } = req.body
				const studentEmail = req.user.email

				// Check required fields
				if (!scholarshipId || !paymentStatus) {
					return res
						.status(400)
						.json({ message: 'Missing scholarshipId or paymentStatus' })
				}

				// Find user
				const user = await usersCollection.findOne({ email: studentEmail })
				if (!user) return res.status(404).json({ message: 'User not found' })

				// Validate scholarshipId
				let scholarshipObjectId
				try {
					scholarshipObjectId = new ObjectId(scholarshipId)
				} catch (err) {
					return res.status(400).json({ message: 'Invalid scholarshipId' })
				}

				// Find scholarship
				const scholarship = await scholarshipsCollection.findOne({
					_id: scholarshipObjectId,
				})
				if (!scholarship)
					return res.status(404).json({ message: 'Scholarship not found' })

				// Check if already applied
				const existingApplication = await applicationsCollection.findOne({
					scholarshipId: scholarshipObjectId,
					studentEmail,
				})
				if (existingApplication)
					return res.status(400).json({ message: 'Already applied' })

				// Create application
				const application = {
					scholarshipId: scholarshipObjectId,
					userId: user._id,
					studentEmail,
					universityName: scholarship.universityName,
					scholarshipCategory: scholarship.scholarshipCategory,
					degree: scholarship.degree,
					applicationFees: scholarship.applicationFees,
					serviceCharge: 0,
					applicationStatus: paymentStatus === 'paid' ? 'completed' : 'pending',
					paymentStatus,
					applicationFeedback: '',
					applicationDate: new Date(),
				}

				const result = await applicationsCollection.insertOne(application)
				res.json({ success: true, insertedId: result.insertedId })
			} catch (err) {
				console.error('Application POST error:', err)
				res.status(500).json({ message: 'Server error' })
			}
		})

		// Student view own applications
		app.get('/applications/student', verifyToken, async (req, res) => {
			const email = req.user.email
			const apps = await applicationsCollection
				.find({ studentEmail: email })
				.toArray()
			const formattedApps = apps.map((app) => ({
				...app,
				applicationDate: new Date(app.applicationDate).toLocaleDateString(
					'en-GB',
				),
			}))
			res.json(formattedApps)
		})

		// Admin/Moderator: view all applications
		app.get('/applications', verifyToken, verifyModerator, async (req, res) => {
			const apps = await applicationsCollection
				.find({})
				.project({
					scholarshipId: 1,
					studentEmail: 1,
					universityName: 1,
					scholarshipCategory: 1,
					degree: 1,
					applicationFees: 1,
					serviceCharge: 1,
					applicationStatus: 1,
					paymentStatus: 1,
					applicationFeedback: 1,
					applicationDate: 1,
				})
				.toArray()

			const formattedApps = apps.map((app) => ({
				...app,
				applicationDate: new Date(app.applicationDate).toLocaleDateString(
					'en-GB',
				),
			}))

			res.json(formattedApps)
		})

		// Update payment success
		app.patch('/applications/:id/payment-success',
			verifyToken,
			async (req, res) => {
				const applicationId = req.params.id
				try {
					const result = await applicationsCollection.updateOne(
						{ _id: new ObjectId(applicationId) },
						{ $set: { paymentStatus: 'paid', applicationStatus: 'completed' } },
					)

					if (result.modifiedCount > 0) {
						res.json({ success: true, message: 'Payment status updated' })
					} else {
						res.status(404).json({
							success: false,
							message: 'Application not found or already updated',
						})
					}
				} catch (err) {
					console.error('Payment success update error:', err)
					res.status(500).json({
						success: false,
						message: 'Failed to update payment status',
					})
				}
			},
		)

		// Update payment cancel
		app.patch(
			'/applications/:id/payment-cancel',
			verifyToken,
			async (req, res) => {
				const applicationId = req.params.id
				const result = await applicationsCollection.updateOne(
					{ _id: new ObjectId(applicationId) },
					{ $set: { paymentStatus: 'unpaid', applicationStatus: 'pending' } },
				)
				if (result.modifiedCount > 0) res.json({ success: true })
				else
					res
						.status(404)
						.json({ success: false, message: 'Application not found' })
			},
		)

app.get('/applications/check', async (req, res) => {
  const { scholarshipId, studentEmail } = req.query;

  if (!scholarshipId || !studentEmail)
    return res.status(400).json({ message: 'Missing parameters' });

  let scholarshipObjectId;
  try {
    scholarshipObjectId = new ObjectId(scholarshipId);
  } catch (err) {
    return res.status(400).json({ message: 'Invalid scholarshipId' });
  }

  try {
    const application = await applicationsCollection.findOne({
      scholarshipId: scholarshipObjectId,
      studentEmail,
    });

  
    res.json({ applied: !!application });
  } catch (err) {
    console.error('Check application error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});



		// ===============================
		// STRIPE PAYMENT
		// ===============================
		app.post('/create-checkout-session', verifyToken, async (req, res) => {
			const { scholarshipId, applicationId, amount } = req.body
			const studentEmail = req.user.email

			if (!scholarshipId || !applicationId || !amount)
				return res.status(400).json({ message: 'Missing fields' })

			try {
				const session = await stripe.checkout.sessions.create({
					payment_method_types: ['card'],
					mode: 'payment',
					line_items: [
						{
							price_data: {
								currency: 'usd',
								product_data: { name: 'Scholarship Application Fee' },
								unit_amount: amount * 100,
							},
							quantity: 1,
						},
					],
 success_url: `https://stellar-panda-a9ac66.netlify.app/payment-success?applicationId=${applicationId}`,
cancel_url: `https://stellar-panda-a9ac66.netlify.app/payment-cancel?applicationId=${applicationId}`,

					metadata: { applicationId, scholarshipId, studentEmail },
				})

				res.json({ url: session.url })
			} catch (err) {
				console.error('Stripe error:', err)
				res.status(500).json({ message: 'Stripe session failed' })
			}
		})

		// Webhook to handle Stripe payment confirmation
		app.patch('/update-payment-status', async (req, res) => {
			const { applicationId } = req.body

			if (!applicationId) {
				return res.status(400).json({
					success: false,
					message: 'Missing applicationId',
				})
			}

			try {
				const result = await applicationsCollection.updateOne(
					{ _id: new ObjectId(applicationId) },
					{
						$set: {
							paymentStatus: 'paid',
							applicationStatus: 'completed',
						},
					},
				)

				if (result.modifiedCount > 0) {
					res.json({ success: true })
				} else {
					res.status(404).json({
						success: false,
						message: 'Application not found or already updated',
					})
				}
			} catch (err) {
				console.error(err)
				res.status(500).json({ success: false })
			}
		})
	} catch (err) {
		console.error(err)
	}
}

run()

// ===============================
// BASIC ROUTE
// ===============================
app.get('/', (req, res) => res.send('ScholarStream Server Running'))

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
