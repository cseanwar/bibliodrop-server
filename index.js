const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const Stripe = require("stripe");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db("bibliodrop_db");
    const booksCollection = db.collection("books");
    const usersCollection = db.collection("user");
    const reviewsCollection = db.collection("reviews");
    const deliveryRequestsCollection = db.collection("delivery_requests");
    const transactionsCollection = db.collection("transactions");

    // Books related api
    app.post("/api/books", async (req, res) => {
        const book = {
            ...req.body,

            status: "Pending Approval",

            availability: "Available",

            createdAt: new Date(),
        };

        const result = await booksCollection.insertOne(book);

        res.send(result);
    });

    app.get("/api/books", async (req, res) => {
        const {
            search = "",
            category = "",
            sort = "",
        } = req.query;

        const query = {
            status: "Published",
        };

        if (search) {
            query.title = {
            $regex: search,
            $options: "i",
            };
        }

        if (category) {
            query.category = category;
        }

        let cursor = booksCollection.find(query);

        if (sort === "newest") {
            cursor = cursor.sort({
            createdAt: -1,
            });
        }

        if (sort === "fee-asc") {
            cursor = cursor.sort({
            deliveryFee: 1,
            });
        }

        if (sort === "fee-desc") {
            cursor = cursor.sort({
            deliveryFee: -1,
            });
        }

        const result = await cursor.toArray();

        res.send(result);
    });

    // Apis for dashboard/admin/book-approval queue page
    app.get("/api/books/pending", async (req, res) => {
        const result = await booksCollection
            .find({
            status: "Pending Approval",
            })
            .sort({
            createdAt: -1,
            })
            .toArray();

        res.send(result);
    });
    
    app.get("/api/books/librarian/:email", async (req, res) => {
        const email = req.params.email;

        const result = await booksCollection
            .find({ librarianEmail: email })
            .sort({ createdAt: -1 })
            .toArray();

        res.send(result);
    });

    app.patch("/api/books/approve/:id", async (req, res) => {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid Book ID",
            });
        }

        const result = await booksCollection.updateOne(
            {
            _id: new ObjectId(id),
            },
            {
            $set: {
                status: "Published",
            },
            }
        );

        res.send(result);
    });

    
    app.patch("/api/books/toggle-status/:id", async (req, res) => {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid Book ID",
            });
        }

        const book = await booksCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!book) {
            return res.status(404).send({
                message: "Book not found",
            });
        }

        if (book.status === "Pending Approval") {
            return res.status(403).send({
            message: "Pending books cannot be published",
            });
        }

        const newStatus =
            book.status === "Published"
            ? "Unpublished"
            : "Published";

        const result = await booksCollection.updateOne(
            { _id: new ObjectId(id) },
            {
            $set: {
                status: newStatus,
            },
            }
        );

        res.send(result);
    });

    // Get single book api for edit
    app.get("/api/books/:id", async (req, res) => {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid Book ID",
            });
        }

        const result = await booksCollection.findOne({
            _id: new ObjectId(id),
        });

        res.send(result);
    });


    app.patch("/api/books/:id", async (req, res) => {
        try {
            const { id } = req.params;

            const updates = req.body;

            if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid Book ID",
            });
        }

            const result = await booksCollection.updateOne(
            {
                _id: new ObjectId(id),
            },
            {
                $set: updates,
            }
            );

            res.send({
            success: true,
            modifiedCount: result.modifiedCount,
            });
        } catch (error) {
            console.error(error);

            res.status(500).send({
            success: false,
            message: error.message,
            });
        }
    });

    app.delete("/api/books/:id", async (req, res) => {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid Book ID",
            });
        }

        const result = await booksCollection.deleteOne({
            _id: new ObjectId(id),
        });

        res.send(result);
    });

    app.get("/api/admin/books", async (req, res) => {
        const result = await booksCollection
            .find()
            .sort({ createdAt: -1 })
            .toArray();

        res.send(result);
    });

    app.delete("/api/admin/books/:id", async (req, res) => {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid Book ID",
            });
        }

        const result = await booksCollection.deleteOne({
            _id: new ObjectId(id),
        });

        res.send(result);
    });

    app.patch("/api/admin/books/status/:id", async (req, res) => {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid Book ID",
            });
        }

        const book = await booksCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!book) {
            return res.status(404).send({
                message: "Book not found",
            });
        }

        const newStatus =
            book.status === "Published"
                ? "Unpublished"
                : "Published";

        const result = await booksCollection.updateOne(
            {
                _id: new ObjectId(id),
            },
            {
                $set: {
                    status: newStatus,
                },
            }
        );

        res.send(result);
    });

    app.get("/api/admin/stats", async (req, res) => {
        try {
            const totalUsers =
                await usersCollection.countDocuments();

            const totalBooks =
                await booksCollection.countDocuments();

            const totalDeliveries =
                await deliveryRequestsCollection.countDocuments();

            const deliveries =
                await deliveryRequestsCollection
                    .find()
                    .toArray();

            const totalRevenue = deliveries.reduce(
                (sum, delivery) =>
                    sum + Number(delivery.deliveryFee || 0),
                0
            );

            const categoryData = await booksCollection
                .aggregate([
                    {
                        $group: {
                            _id: "$category",
                            count: { $sum: 1 },
                        },
                    },
                ])
                .toArray();

            res.send({
                totalUsers,
                totalBooks,
                totalDeliveries,
                totalRevenue,
                categoryData,
            });
        } catch (error) {
            res.status(500).send({
                message: error.message,
            });
        }
    });

    app.get("/api/admin/transactions", async (req, res) => {
        const result = await deliveryRequestsCollection
            .find({
            status: "Delivered",
            })
            .sort({
            requestedAt: -1,
            })
            .toArray();

        res.send(
            result.map((item) => ({
            _id: item._id,
            userEmail: item.userEmail,
            librarianEmail: item.librarianEmail,
            amount: item.deliveryFee || 0, // IMPORTANT FIX
            createdAt: item.requestedAt,   // IMPORTANT FIX
            }))
        );
    });

    app.post("/api/transactions", async (req, res) => {
        try {
            const transaction = {
            ...req.body,
            createdAt: new Date(),
            };

            const result =
            await transactionsCollection.insertOne(
                transaction
            );

            res.send(result);
        } catch (error) {
            console.error(error);

            res.status(500).send({
            message: "Failed to save transaction",
            });
        }
    });

    app.get("/api/librarian/stats/:email", async (req, res) => {
        const { email } = req.params;

        const totalBooksListed = await booksCollection.countDocuments({
            librarianEmail: email,
        });

        const activePendingRequests =
            await deliveryRequestsCollection.countDocuments({
            librarianEmail: email,
            status: "Pending",
            });

        const deliveries = await deliveryRequestsCollection
            .find({
            librarianEmail: email,
            status: "Delivered",
            })
            .toArray();

        let totalEarnings = 0;

        for (const delivery of deliveries) {
            const book = await booksCollection.findOne({
                _id: new ObjectId(delivery.bookId),
            });

            totalEarnings += Number(book?.deliveryFee || 0);
        }

        const mostRequestedBooks =
            await deliveryRequestsCollection
            .aggregate([
                {
                $match: {
                    librarianEmail: email,
                },
                },
                {
                $group: {
                    _id: "$bookTitle",
                    requests: {
                    $sum: 1,
                    },
                },
                },
                {
                $sort: {
                    requests: -1,
                },
                },
                {
                $limit: 5,
                },
            ])
            .toArray();

        res.send({
            totalBooksListed,
            totalEarnings,
            activePendingRequests,
            mostRequestedBooks,
        });
    });



    // User related api route
    // Get all users
    app.get("/api/users", async (req, res) => {
        try {
            const result = await usersCollection
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

            res.send(result);
        } catch (error) {
            res.status(500).send({
            message: error.message,
            });
        }
    });

    // Update role
    app.patch("/api/users/role/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const { role } = req.body;

            if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid User ID",
            });
            }

            const result = await usersCollection.updateOne(
            {
                _id: new ObjectId(id),
            },
            {
                $set: {
                role,
                },
            }
            );

            res.send(result);
        } catch (error) {
            res.status(500).send({
            message: error.message,
            });
        }
    });

    // Delete user
    app.delete("/api/users/:id", async (req, res) => {
        try {
            const { id } = req.params;

            if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid User ID",
            });
            }

            const result = await usersCollection.deleteOne({
            _id: new ObjectId(id),
            });

            res.send(result);
        } catch (error) {
            res.status(500).send({
            message: error.message,
            });
        }
    });

    
    // Payment related apis
    app.post("/api/create-checkout-session",async (req, res) => {
        try {
        const {
            bookId,
            title,
            deliveryFee,
            userEmail,
        } = req.body;

        const session =
            await stripe.checkout.sessions.create({
            payment_method_types: [
                "card",
            ],

            line_items: [
                {
                price_data: {
                    currency: "usd",

                    product_data: {
                    name: title,
                    },

                    unit_amount:
                    Number(
                        deliveryFee
                    ) * 100,
                },

                quantity: 1,
                },
            ],

            mode: "payment",

            success_url:
                `${process.env.CLIENT_URL}/payment-success?bookId=${bookId}`,

            cancel_url:
                `${process.env.CLIENT_URL}/books/${bookId}`,

            metadata: {
                bookId,
                userEmail,
            },
            });

        res.send({
            url: session.url,
        });
        } catch (error) {
        console.error(error);

        res.status(500).send({
            message:
            "Failed to create checkout session",
        });
        }
    });

    


    // Delivery related apis
    app.get("/api/deliveries/librarian/:email", async (req, res) => {
        const email = req.params.email;

        const result = await deliveryRequestsCollection
            .find({
            librarianEmail: email,
            })
            .sort({
            requestedAt: -1,
            })
            .toArray();

        res.send(result);
    });

    app.post("/api/delivery-request", async (req, res) => {
        try {
            const request = req.body;

            const book = await booksCollection.findOne({
            _id: new ObjectId(request.bookId),
            });

            if (!book) {
            return res.status(404).send({
                message: "Book not found",
            });
            }

            const existingRequest =
            await deliveryRequestsCollection.findOne({
                bookId: request.bookId,
                userEmail: request.userEmail,
                status: {
                $in: [
                    "Pending",
                    "Approved",
                    "Shipped",
                    "Delivered",
                ],
                },
            });

            if (existingRequest) {
            return res.status(400).send({
                message:
                "You already have an active request for this book",
            });
            }

            const deliveryRequest = {
                bookId: request.bookId,

                bookTitle: book.title,
                bookImage: book.image,

                librarianEmail: book.librarianEmail,

                deliveryFee: Number(book.deliveryFee),

                userEmail: request.userEmail,
                userName: request.userName,

                status: "Pending",
                requestedAt: new Date(),
            };

            if (book.availability === "Checked Out") {
                return res.status(400).send({
                    message: "Book is already checked out",
                });
            }
                

            const result =
                await deliveryRequestsCollection.insertOne(
                    deliveryRequest
            );

            await transactionsCollection.insertOne({
                bookId: request.bookId,
                bookTitle: book.title,

                librarianEmail: book.librarianEmail,

                userEmail: request.userEmail,
                userName: request.userName,

                amount: Number(book.deliveryFee),

                createdAt: new Date(),
            });

            await booksCollection.updateOne(
                {
                    _id: new ObjectId(request.bookId),
                },
                {
                    $set: {
                    availability: "Checked Out",
                    requestedBy: request.userEmail,
                    },
                }
            );

            res.send(result);
        } catch (error) {
            console.error(error);

            res.status(500).send({
            message: "Failed to create delivery request",
            });
        }
    });

    app.patch("/api/deliveries/:id", async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                message: "Invalid Delivery ID",
            });
            }

            const result =
            await deliveryRequestsCollection.updateOne(
                {
                _id: new ObjectId(id),
                },
                {
                $set: {
                    status,
                    updatedAt: new Date(),
                },
                }
            );

            // if (status === "Delivered") {
            // const delivery =
            //     await deliveryRequestsCollection.findOne({
            //     _id: new ObjectId(id),
            //     });

            // await booksCollection.updateOne(
            //     {
            //         _id: new ObjectId(delivery.bookId),
            //     },
            //     {
            //         $set: {
            //             availability: "Checked Out",
            //             },
            //         }
            //     );
            // }

            res.send(result);
        } catch (error) {
            console.error(error);

            res.status(500).send({
            message: "Failed to update delivery",
            });
        }
    });


    // Delivery history api for user dashboard
    app.get("/api/deliveries/user/:email", async (req, res) => {
        const {email} = req.params;

        const result = await deliveryRequestsCollection
            .find({
            userEmail: email,
            })
            .sort({
            requestedAt: -1,
            })
            .toArray();

        res.send(result);
    });

    // User reading list api
    app.get("/api/reading-list/:email", async (req, res) => {
        try {
            const { email } = req.params;

            const deliveries = await deliveryRequestsCollection
            .find({
                userEmail: email,
                status: "Delivered",
            })
            .toArray();

            const bookIds = deliveries.map(
            (item) => new ObjectId(item.bookId)
            );

            const books = await booksCollection
            .find({
                _id: { $in: bookIds },
            })
            .toArray();

            res.send(books);
        } catch (error) {
            console.error(error);

            res.status(500).send({
            message: "Failed to load reading list",
            });
        }
    });

    // Reviews by user related api
    app.get("/api/reviews/user/:email", async (req, res) => {
        const { email } = req.params;

        const result = await reviewsCollection
            .find({
            userEmail: email,
            })
            .sort({
            createdAt: -1,
            })
            .toArray();

        res.send(result);
    });

    app.post("/api/reviews", async (req, res) => {
        try {
            const review = req.body;

            const deliveredBook =
            await deliveryRequestsCollection.findOne({
                bookId: review.bookId,
                userEmail: review.userEmail,
                status: "Delivered",
            });

            if (!deliveredBook) {
            return res.status(403).send({
                success: false,
                message:
                "Only users who received the book can review it.",
            });
            }

            const existingReview =
            await reviewsCollection.findOne({
                bookId: review.bookId,
                userEmail: review.userEmail,
            });

            if (existingReview) {
            return res.status(400).send({
                success: false,
                message:
                "You have already reviewed this book.",
            });
            }

            const newReview = {
            ...review,
            createdAt: new Date(),
            };

            const result =
            await reviewsCollection.insertOne(
                newReview
            );

            res.send({
            success: true,
            insertedId: result.insertedId,
            });
        } catch (error) {
            console.error(error);

            res.status(500).send({
            success: false,
            message: error.message,
            });
        }
    });

    app.get("/api/reviews/book/:bookId", async (req, res) => {
        const { bookId } = req.params;

        const result = await reviewsCollection
        .find({ bookId })
        .sort({ createdAt: -1 })
        .toArray();

        res.send(result);
    });

    app.patch("/api/reviews/:id", async (req, res) => {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
            message: "Invalid Review ID",
            });
        }

        const result = await reviewsCollection.updateOne(
            {
            _id: new ObjectId(id),
            },
            {
            $set: {
                rating: req.body.rating,
                comment: req.body.comment,
                updatedAt: new Date(),
            },
            }
        );

        res.send(result);
    });

    app.delete("/api/reviews/:id", async (req, res) => {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
            message: "Invalid Review ID",
            });
        }

        const result = await reviewsCollection.deleteOne({
            _id: new ObjectId(id),
        });

        res.send(result);
    });

    app.get("/api/reviews/can-review/:bookId/:email", async (req, res) => {
        const { bookId, email } =
        req.params;

        const delivery =
        await deliveryRequestsCollection.findOne({
            bookId,
            userEmail: email,
            status: "Delivered",
        });

        res.send({
        canReview: !!delivery,
        });
    });

    app.get("/api/books/related/:category/:bookId", async (req, res) => {
        const { category, bookId } = req.params;

        const result =
        await booksCollection.find({ category,
            status: "Published",
            _id: {
                $ne: new ObjectId(bookId),
            },}).limit(4).toArray();

        res.send(result);
    });

    // Api route for user overview page
    app.get("/api/dashboard/user/:email", async (req, res) => {
        const { email } = req.params;

        const deliveries = await deliveryRequestsCollection
            .find({ userEmail: email })
            .toArray();

        const totalBooksRead = deliveries.filter(
            (d) => d.status === "Delivered"
        ).length;

        const pendingDeliveries = deliveries.filter(
            (d) => d.status !== "Delivered"
        ).length;

        const totalSpent = deliveries.reduce(
            (sum, item) => sum + Number(item.deliveryFee || 0),
            0
        );

        res.send({
            totalBooksRead,
            pendingDeliveries,
            totalSpent,
        });
    });

    app.get("/api/dashboard/user/chart/:email", async (req, res) => {
        const { email } = req.params;

        const deliveries = await deliveryRequestsCollection
            .find({
            userEmail: email,
            status: "Delivered",
            })
            .toArray();

        const chartData = {};

        deliveries.forEach((item) => {
            const month = new Date(item.updatedAt).toLocaleString(
            "default",
            {
                month: "short",
            }
            );

            chartData[month] =
            (chartData[month] || 0) + 1;
        });

        const result = Object.entries(chartData).map(
            ([month, books]) => ({
            month,
            books,
            })
        );

        res.send(result);
    });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});