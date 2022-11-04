//imports --------------------
const express = require('express');
const cors = require('cors');
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

async function run() {
    try {
        const upcomingToursData = client.db('TakeATrip').collection('upcomingTours');
        const createdAgencyData = client.db('TakeATrip').collection('createdAgency');

        //upcoming tour api
        app.get('/upcomingTours', async (req, res) => {
            const query = {}
            const cursor = upcomingToursData.find(query);
            const upcomingTours = await cursor.toArray();
            res.send(upcomingTours);
        })

        app.get('/upcomingTours/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const upcomingTour = await upcomingToursData.findOne(query);
            res.send(upcomingTour)
        });


        //Created Agency Api
        app.get('/createAgency', async (req, res) => {
            let query = {};
            if (req.query.agencyEmail) {
                query = {
                    agencyEmail: req.query.agencyEmail
                }
            }
            console.log(req.query.agencyEmail);
            const cursor = createdAgencyData.find(query);
            const createdAgency = await cursor.toArray();
            res.send(createdAgency);
        });

        app.post('/createAgency', async (req, res) => {
            const createAgency = req.body;
            const result = await createdAgencyData.insertOne(createAgency);
            res.send(result);
        });

        app.delete('/createAgency/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await createdAgencyData.deleteOne(query);
            res.send(result);
        })



    }

    finally {

    }
}

run().catch((error) => console.log(error))

app.get('/', (req, res) => {
    res.send('Take A Trip Server is running');
})

app.listen(port, () => {
    console.log('Take A Trip Server is running in port number', port);
})