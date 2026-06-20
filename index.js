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
    const deliveryRequestsCollection = db.collection("delivery_requests");

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
                message: "Invalid Book ID",
            });
        }

        const result = await deliveryRequestsCollection.updateOne(
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