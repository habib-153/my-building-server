const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);

const mg = mailgun.client({
  username: "api",
  key: process.env.MAIL_GUN_API_KEY,
});

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
    const paymentCollection = client.db("myBuilding").collection("payments")

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

    app.get('/members', verifyToken, async(req, res)=>{
      const role = 'member'
      const query = {role: role}
      const result = await userCollection.find(query).toArray()
      res.send(result)
    })

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
    // member update
    app.patch(
      "/users/member/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email: email };
        const updatedDoc = {
          $set: {
            role: "member",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.patch(
      "/users/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "user",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    app.patch("/users", async(req,res)=>{
      const updatedUser = req.body;
      const email = updatedUser.email
      const filter = { email: email}
      const updatedDoc = {
        $set: {
          email: updatedUser.email,
          name: updatedUser.name
        }
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

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
  // ---------------------------------------
  // BookedApartment
  app.post('/bookedApartment', verifyToken, verifyAdmin, async(req,res) =>{
    const apartment = req.body
    const result = await bookedApartmentCollection.insertOne(apartment)
    res.send(result)
  })

  app.get('/bookedApartment/:email', verifyToken, async(req, res)=>{
    const query = { userEmail: req.params.email}
    if(req.params.email !== req.decoded.email){
      return res.status(403).send({message: 'forbidden'})
    }
    const result = await bookedApartmentCollection.find(query).toArray()
    res.send(result)
  })
  // ---------------------------------------

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
        Status: updatedAgreement.Status,
        // checkingTime: updatedAgreement.checkingTime
      },
    };
    const result = await agreementRequestCollection.updateOne(filter, updateDoc)

    let emailContent = {
      accepted: {
        subject: "Congratulations!",
        text: "Your agreement request has been accepted.",
        html: "<div><h2>Congratulations!</h2><h4>Your agreement request has been accepted.</h4></div>"
      },
      rejected: {
        subject: "Sorry",
        text: "Your agreement request has been rejected.",
        html: "<div><h2>Sorry</h2><h4>Your agreement request has been rejected.</h4></div>"
      }
    };
    
    // Check the action and assign the appropriate content
    let action = updatedAgreement.action;
    let content;
    if (action === "Accepted") {
      content = emailContent.accepted;
    } else if (action === "Rejected") {
      content = emailContent.rejected;
    } else {
      // Handle other cases
    }
    
    // Send the email with the content
    mg.messages
  .create(process.env.MAIL_SENDING_DOMAIN, {
    from: "Mailgun Sandbox <postmaster@sandbox59983a7e403f4affbcfb5457d3af61a4.mailgun.org>",
    to: ["h.r.sihab155@gmail.com"],
        subject: content.subject,
        text: content.text,
        html: content.html
      })
      .then((msg) => console.log(msg)) // logs response data
      .catch((err) => console.log(err)); 
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
    app.post('/create-payment-intent', async(req, res)=>{
      const {price} = req.body
      const amount = parseInt(price * 100)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: [
          "card"
        ],
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    app.post('/payments', async(req, res)=>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment)
      console.log('payment info', payment)
      res.status(200).send(paymentResult)
    })

    app.get('/payments/:email', verifyToken, async(req, res)=>{
      const query = { email: req.params.email}
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden'})
      }
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })
    
    // -----------------------------
    // Stats and Analytics

    app.get('/admin-stats', verifyToken, verifyAdmin, async(req, res) =>{
      const role = 'member'
      const query = { role: role }
      const totalMembers = await userCollection.countDocuments(query);
      
      const users = await userCollection.estimatedDocumentCount()
      const apartments = await apartmentCollection.estimatedDocumentCount()
      const bookedApartments = await bookedApartmentCollection.estimatedDocumentCount()
      const availablePer = ((apartments - bookedApartments)/apartments)*100
      const bookedPer = (bookedApartments/apartments)*100
      const apartmentPer = (apartments/apartments)*100
      const payments = await paymentCollection.estimatedDocumentCount()
      const result = await paymentCollection.aggregate([
        {
          $group:{
            _id: null,
            totalRevenue:{
              $sum: '$rent'
            }
          }
        }
      ]).toArray()
      const revenue = result.length > 0 ? result[0].totalRevenue :0 ;
      res.send({
        users, apartmentPer, apartments, totalMembers, availablePer, bookedPer, bookedApartments, payments, revenue
      })
    })

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
