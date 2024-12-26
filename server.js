const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const express = require("express");
require("dotenv").config();
const cors = require("cors");

const app = express();

const port = process.env.PORT;
// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://whereisit-84e04.web.app",
      "https://whereisit-84e04.firebaseapp.com",
      "https://whereisit-lostandfound123443.surge.sh",
    ],

    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1zs5t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// secret key from .env file ->
// steps to create SECRET_KEY
// step 1: open terminal and input > node
// step 2: require('crypto').randomBytes(64).toString('hex') // for creating 64 bytes hexaDec code
// step 3: now copy it and paste in your .env file
const secretKey = process.env.SECRET_KEY;

// validate token as a middleware
// step 1: get the token from cookies
// step 2: if the token in undefined/notIncluded through an error of "Unauthorized"
// step 3: verify token (it takes a callback func in its last param)
// step 3.1: if here is any secret/token related issue through again error
// step 3.2: if everything is fine give the decoded user data in request obj
// step 4: call the next function so that it will got to the next step
const varifyToken = (req, res, next) => {
  const token = req.cookies?.ACCESS_TOKEN;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized (no token)" });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unlauthorized (verify failed)" });
    }

    req.user = decoded;

    next();
  });
};

(async function () {
  try {
    // connect mongodb
    // await client.connect();
    const db = client.db("LostAndFoundItemsDB");
    const postCollection = db.collection("allPost");
    const reocveriesCollection = db.collection("recoveriesItems");
    const reviewsCollection = db.collection("allReviews");

    // CREATE JWT token after user authenticate and send it to to the client side
    app.post("/create-jwt", (req, res) => {
      const payload = req.body; // user email from client
      const token = jwt.sign(payload, secretKey, {});

      res
        .cookie("ACCESS_TOKEN", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ message: "Login Success!" });
    });

    // clear the JWT token if the user logout or expire the cookie
    app.post("/remove-jwt", (req, res) => {
      res
        .clearCookie("ACCESS_TOKEN", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ message: "Cookie logout" });
    });
    // get all posts || for latest post (tells in the query) sorting and getting 6 post
    // && get searched/filtered posts/data
    app.get("/posts", async (req, res) => {
      try {
        const searchText = req.query?.searchText;

        // for pagination data
        const page = req.query?.page || 0;
        const size = req.query?.size || 6;

        let query = {};
        let options = {
          skip: parseInt(page * size),
          limit: parseInt(size),
        };

        if (searchText === "latest") {
          options.sort = { date: -1 };
        } else if (searchText) {
          query = {
            $or: [
              { title: { $regex: searchText, $options: "i" } },
              { location: { $regex: searchText, $options: "i" } },
            ],
          };
        }

        const posts = await postCollection.find(query, options).toArray();
        if (!posts?.length) {
          return res.status(404).json({ message: "No matching data found" });
        }
        res.send(posts);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get single post
    app.get("/posts/:id", varifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const post = await postCollection.findOne(query);
        res.send(post);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get my posts
    app.get("/my-posts/:email", varifyToken, async (req, res) => {
      try {
        if (req?.user?.email !== req.params.email) {
          return res.status(403).send({ message: "Forbidden" });
        }

        const filter = { email: req.params.email };
        const result = await postCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get my all recovered post
    app.get("/recovered", varifyToken, async (req, res) => {
      try {
        const email = req.query?.email;
        if (email !== req?.user?.email) {
          return res.status(403).send({ message: "Forbidden" });
        }

        const query = { email: email, status: "recovered" };
        const recoveredPosts = await postCollection.find(query).toArray();
        if (!recoveredPosts.length) {
          return res.status(404).send({ message: "No data found" });
        }
        res.send(recoveredPosts);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get all review
    app.get("/reviews", async (req, res) => {
      try {
        const result = await reviewsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get total post count for pagination
    app.get("/total-post-count", async (req, res) => {
      try {
        const count = await postCollection.estimatedDocumentCount();
        res.send({ count });
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // Add/post a Items
    app.post("/posts", varifyToken, async (req, res) => {
      try {
        const doc = req.body;

        const result = await postCollection.insertOne(doc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // post new data on "recoveries" collection
    app.post("/recoveries", varifyToken, async (req, res) => {
      try {
        const postId = req.body.postId;
        // set status of "recovered" data of postCollection
        const filter = { _id: new ObjectId(postId) };

        const updateWith = {
          $set: {
            status: "recovered",
          },
        };
        const options = { upsert: true };

        // update Current Post By Status
        await postCollection.updateOne(filter, updateWith, options);

        // now post the recovered item
        const doc = req.body;
        const result = await reocveriesCollection.insertOne(doc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // add new review
    app.post("/reviews", varifyToken, async (req, res) => {
      try {
        const doc = req.body;
        const result = await reviewsCollection.insertOne(doc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // update my post/data
    app.patch("/my-posts/update/:postId", varifyToken, async (req, res) => {
      try {
        const id = req.params?.postId;
        const query = { _id: new ObjectId(id) };
        const updatedPost = {
          $set: req.body,
        };
        const result = await postCollection.updateOne(query, updatedPost);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // delete my post
    app.delete("/delete/:postId", varifyToken, async (req, res) => {
      try {
        if (req.query?.email !== req?.user?.email) {
          return res.status(403).send({ message: "Forbidden" });
        }
        const id = req.params.postId;
        const filter = { _id: new ObjectId(id) };
        const result = await postCollection.deleteOne(filter);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    console.log("database has pinned");
  } catch (error) {
    console.dir(error);
  }
})();

// server default root page
app.get("/", (_, res) => {
  res.send(`
      <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Server Running</title>
  </head>
  <body style="margin: 0; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f4f4f9; color: #333;">
      <div style="text-align: center;">
          <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #0078d7;"><span style="color: red">"</span>WhereIsIt<span style="color: red">"</span> Server is Running</h1>
          <p style="font-size: 1.2rem; color: #555;">Your server is up and ready to serve requests.</p>
          <div style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; border-radius: 8px; background-color: #e6f7ff; color: #00509e; font-weight: bold;">
              Status: Online
          </div>
      </div>
  </body>
  </html>
  
      `);
});
// listening the server using port (included in env)
app.listen(port, () => {
  console.log(`Server running PORT on: ${port}`);
});
