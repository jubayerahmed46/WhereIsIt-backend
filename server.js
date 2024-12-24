const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const app = express();

const port = process.env.PORT;
// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1zs5t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

(async function () {
  try {
    // connect mongodb
    await client.connect();
    const db = client.db("LostAndFoundItemsDB");
    const postCollection = db.collection("allPost");
    const reocveriesCollection = db.collection("recoveriesItems");

    // get all posts || for latest post (tells in the query) sorting and getting 6 post
    app.get("/posts", async (req, res) => {
      try {
        const paramData = req?.query?.latest;

        let query = {};
        let options = {};

        if (paramData) {
          options = {
            sort: { date: -1 },
            limit: 6,
          };
        }
        const posts = await postCollection.find(query, options).toArray();

        res.send(posts);
      } catch (error) {
        console.log(error.message);
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get single post
    app.get("/posts/:id", async (req, res) => {
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
    app.get("/my-posts/:email", async (req, res) => {
      try {
        const filter = { email: req.params.email };
        console.log(filter);
        const result = await postCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // get my all recovered post
    app.get("/recovered", async (req, res) => {
      try {
        const email = req.query.email;

        const query = { email: email, status: "recovered" };
        const recoveredPosts = await postCollection.find(query).toArray();
        if (!recoveredPosts.length) {
          res.status(404).send({ message: "No data found" });
        }
        res.send(recoveredPosts);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });
    // Add/post a Items
    app.post("/posts", async (req, res) => {
      try {
        const doc = req.body;

        const result = await postCollection.insertOne(doc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    app.post("/recoveries", async (req, res) => {
      try {
        const postId = req.body.postId;
        // set status of "recovered" data of postCollection

        const filter = { _id: new ObjectId(postId) };
        console.log(filter);
        const updateWith = {
          $set: {
            status: "recovered",
          },
        };
        const options = { upsert: true };

        // update Current Post By Status
        const updateStatus = await postCollection.updateOne(
          filter,
          updateWith,
          options
        );

        console.log(updateStatus);

        // now post the recovered item
        const doc = req.body;
        const result = await reocveriesCollection.insertOne(doc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server Error" });
      }
    });

    // delete my post
    app.delete("/delete/:postId", async (req, res) => {
      try {
        const id = req.params.postId;
        const filter = { _id: new ObjectId(id) };
        console.log(filter);
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
