//imports --------------------
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

//port --------------------
const port = process.env.PORT || 5000;

//middleware --------------------
app.use(cors());
app.use(express.json());

//database connection --------------------
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.dxgxsmu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



/* function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    console.log(authHeader);

    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            res.status(401).send({ message: 'Unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })

} */


async function run() {
    try {
        const upcomingToursCollection = client.db('TakeATrip').collection('upcomingTours');
        const createdAgencyCollection = client.db('TakeATrip').collection('createdAgency');
        const postsCollection = client.db('TakeATrip').collection('posts');
        const usersCollection = client.db('TakeATrip').collection('users');

        //new post
        app.post('/posts', async (req, res) => {
            const newPost = req.body;
            const result = await postsCollection.insertOne(newPost);
            res.send(result);
        });

        //post api
        app.get('/posts', async (req, res) => {
            const query = {};
            const posts = await postsCollection.find(query).sort({time: -1}).toArray();
            res.send(posts)
        });

        //upcoming tour api for all upcoming data
        app.get('/upcomingTours', async (req, res) => {
            const query = {}
            const cursor = upcomingToursCollection.find(query);
            const upComingTourData = await cursor.toArray();
            const count = await upcomingToursCollection.estimatedDocumentCount();
            res.send({ count, upComingTourData });
        })

        app.post('/upcomingTours', async (req, res) => {
            const upcomingTour = req.body;
            const result = await upcomingToursCollection.insertOne(upcomingTour);
            res.send(result);
        });

        //upcoming tour api for single upcoming tour data selected by the user
        app.get('/upcomingTours/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const upcomingTour = await upcomingToursCollection.findOne(query);
            res.send(upcomingTour)
        });


        //Created Agency Api
        app.get('/createAgency', async (req, res) => {
            /* const decoded = req.decoded;
            console.log('inside create agency api', decoded);

            if (decoded.email !== req.query.agencyEmail) {
                res.status(403).send({ message: 'Forbidden access' })
            } */
            let query = {};
            if (req.query.agencyEmail) {
                query = {
                    agencyEmail: req.query.agencyEmail
                }
            }
            const cursor = createdAgencyCollection.find(query);
            const createdAgency = await cursor.toArray();
            res.send(createdAgency);
        });

        app.post('/createAgency', async (req, res) => {
            const createAgency = req.body;
            const result = await createdAgencyCollection.insertOne(createAgency);
            res.send(result);
        });

        app.delete('/createAgency/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await createdAgencyCollection.deleteOne(query);
            res.send(result);
        })
    }

    finally {

    }
}

// JWT Token --------------------
/* app.post('/jwt', (req, res) => {
    const user = req.body;
    console.log(user);
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2 days' })
    res.send({ token })

}) */


run().catch((error) => console.log(error))

app.get('/', (req, res) => {
    res.send('Take A Trip Server is running');
})

app.listen(port, () => {
    console.log('Take A Trip Server is running in port number', port);
})