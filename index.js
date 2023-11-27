const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

//bistroBoss

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.29d8nwh.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const apartmentCollection = client.db("myBuilding").collection("apartment");
    const bookedApartmentCollection = client.db("myBuilding").collection("bookedApartment");
    const couponCollection = client.db("myBuilding").collection("coupon");
    const announcementCollection = client.db("myBuilding").collection("announcement");
    const agreementRequestCollection = client.db("myBuilding").collection("agreementRequests");
    const userCollection = client.db("myBuilding").collection("users");

    // -------------------------------
    // jwt api's
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log(req.headers);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden" });
      }
      next();
    };
    // -----------------------------
    // user related api

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });
    app.get("/users/member/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let member = false;
      if (user) {
        member = user?.role === "member";
      }
      res.send({ member });
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // ------------------------------
    // coupon api
    app.get("/coupon", async (req, res) => {
      const result = await couponCollection.find().toArray();
      res.send(result);
    });

    app.post('/coupon', async(req,res)=>{
      const newCoupon = req.body
      const result = await couponCollection.insertOne(newCoupon)
      res.send(result)
    })
    app.delete('/coupon/:id',verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id
      const query = { _id: new ObjectId(id)}
      const result = await couponCollection.deleteOne(query)
      res.send(result)
    })
    //-------------------------------
    // Apartments Api
    app.post('/apartment', verifyToken, verifyAdmin, async(req,res) =>{
      const apartment = req.body
      const result = await apartmentCollection.insertOne(apartment)
      res.send(result)
    })

    app.get('/apartment', async(req, res)=>{
      const page = parseInt(req.query.page)
      const size = parseInt(req.query.size)
      const result = await apartmentCollection
      .find()
      .skip(page*size)
      .limit(size)
      .toArray()
      res.send(result)
  })

  app.get("/apartmentsCount", async (req, res) => {
    const count = await apartmentCollection.estimatedDocumentCount();
    res.send({ count });
  });

  // AgreementREquest
  app.post('/agreementRequests', verifyToken, async(req,res) =>{
    const item = req.body
    const result = await agreementRequestCollection.insertOne(item)
    res.send(result)
  })

  app.get("/agreementRequests",verifyToken, verifyAdmin, async (req, res) => {
    const result = await agreementRequestCollection.find().toArray();
    res.send(result);
  });

  app.patch('/agreementRequests/:id', async(req, res) =>{
    const id = req.params.id;
    const filter = { _id: new ObjectId(id)}
    const updatedAgreement = req.body;
    const updateDoc ={
      $set:{
        status: updatedAgreement.status,
        checkingTime: updatedAgreement.checkingTime
      },
    };
    const result = await agreementRequestCollection.updateOne(filter, updateDoc)
    res.send(result)
  })

  // Announcements
  app.post('/announcement', verifyToken, verifyAdmin, async(req,res) =>{
    const announcement = req.body
    const result = await announcementCollection.insertOne(announcement)
    res.send(result)
  })

  app.get("/announcement", async (req, res) => {
    const result = await announcementCollection.find().toArray();
    res.send(result);
  });
  // ---------------------------

    // ------------------------------
    // Payment Intent

    // -----------------------------
    // Stats and Analytics

    // using aggregate pipeline

    // -----------------------------
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Here is my building here");
});
app.listen(port, () => {
  console.log(`Building Located is on port ${port}`);
});
