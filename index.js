const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config();
const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

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
    app.post('/api/books', async (req, res) => {
        const book = req.body;
        const newBook = {
            ...book,
            createdAt: new Date()
        }
        const result = await booksCollection.insertOne(newBook);
        res.send(result);
    })

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
        const result = await transactionsCollection
            .find()
            .sort({
            createdAt: -1,
            })
            .toArray();

        res.send(result);
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

        const totalEarnings = deliveries.reduce(
            (sum, item) => sum + Number(item.deliveryFee || 0),
            0
        );

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

    app.patch("/api/deliveries/:id", async (req, res) => {
        const { id } = req.params;

        const { status } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
            message: "Invalid Delivery ID",
            });
        }

        const delivery =
            await deliveryRequestsCollection.findOne({
            _id: new ObjectId(id),
            });

        if (!delivery) {
            return res.status(404).send({
            message: "Delivery not found",
            });
        }

        const allowedStatuses = [
            "Pending",
            "Dispatched",
            "Delivered",
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).send({
            message: "Invalid status",
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

        res.send(result);
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