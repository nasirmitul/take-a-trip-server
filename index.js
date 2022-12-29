//imports --------------------
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const SSLCommerzPayment = require('sslcommerz-lts');
require('dotenv').config();

//port --------------------
const app = express();
const port = process.env.PORT || 5000;

//middleware --------------------
app.use(cors());
app.use(express.json());

//ssl commerz --------------------
const store_id = process.env.SSL_STORE_ID
const store_passwd = process.env.SSL_SECRET_KEY
const is_live = false //true for live, false for sandbox

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
        const paymentsCollection = client.db('TakeATrip').collection('payments');

        //new user
        app.post('/users', async (req, res) => {
            const newUser = req.body;

            const checkUser = await usersCollection.findOne({ email: newUser.email })

            console.log('newUser', newUser);
            console.log('checkUser', checkUser);

            if (newUser?.email === checkUser?.email) {
                return;
            }
            const result = await usersCollection.insertOne(newUser);
            res.send(result);
        });

        //new post
        app.post('/posts', async (req, res) => {
            const newPost = req.body;
            const result = await postsCollection.insertOne(newPost);
            res.send(result);
        });

        //posts api
        app.get('/posts', async (req, res) => {
            const query = {};
            const posts = await postsCollection.find(query).sort({ time: -1 }).toArray();
            res.send(posts)
        });

        //user timeline posts
        app.get('/posts/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const posts = await postsCollection.find(query).sort({ time: -1 }).toArray();
            res.send(posts)
        });

        //add comment
        app.patch('/posts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const comment = req.body;
            console.log(comment);

            const addComment = {
                $push: {
                    comments: comment
                }
            }

            const result = await postsCollection.updateOne(query, addComment);
            res.send(result);
        })

        //add remove react
        app.put('/post_react_add/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const reactInfo = req.body;
            console.log(reactInfo);

            const react = {
                $inc: {
                    reacts: reactInfo.react
                },
                $push: {
                    reacts_uid: reactInfo.uid
                }
            }

            const result = await postsCollection.updateOne(query, react);
            res.send(result);
        })

        app.put('/post_react_remove/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };

            const reactInfo = req.body;
            console.log(reactInfo);

            const react = {
                $inc: {
                    reacts: reactInfo.react
                },
                $pull: {
                    reacts_uid: {
                        $in: [reactInfo.uid]
                    }
                }
            }

            const result = await postsCollection.updateOne(query, react);
            res.send(result);
        })


        //upcoming tour api for all upcoming data
        app.get('/upcomingTours', async (req, res) => {
            const query = {}
            const cursor = upcomingToursCollection.find(query);
            const upComingTourData = await cursor.toArray();
            const count = await upcomingToursCollection.estimatedDocumentCount();
            res.send({ count, upComingTourData });
        })

        //upcoming tour api for right panel api
        app.get('/rightUpcomingTours', async (req, res) => {
            const query = {}
            const cursor = upcomingToursCollection.find(query);
            const upComingTourData = await cursor.limit(3).toArray();
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

        //Payment for tour
        app.post('/payment', async (req, res) => {
            const order = req.body;

            const orderedTour = await upcomingToursCollection.findOne({ _id: ObjectId(order.tour) })

            const transactionId = new ObjectId().toString()

            const data = {
                total_amount: orderedTour.totalCost,
                currency: 'BDT',
                tran_id: transactionId, // use unique tran_id for each api call
                success_url: `http://localhost:5000/payment/success?transactionId=${transactionId}&tourId=${order.tour}`,
                fail_url: 'http://localhost:5000/payment/fail',
                cancel_url: 'http://localhost:5000/payment/cancel',
                ipn_url: 'http://localhost:3030/ipn',
                shipping_method: 'N/A',
                product_name: order.locationName,
                product_category: 'Tour',
                product_profile: 'Tour',
                cus_name: order.username,
                cus_email: order.userEmail,
                cus_add1: order.address,
                cus_add2: 'Dhaka',
                cus_city: 'Dhaka',
                cus_state: 'Dhaka',
                cus_postcode: '1000',
                cus_country: 'Bangladesh',
                cus_phone: order.phone_number,
                cus_fax: '0171111111',
                ship_name: order.username,
                ship_add1: 'Dhaka',
                ship_add2: 'Dhaka',
                ship_city: 'Dhaka',
                ship_state: 'Dhaka',
                ship_postcode: 1000,
                ship_country: 'Bangladesh',
            };

            const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
            sslcz.init(data).then(apiResponse => {
                // Redirect the user to payment gateway
                let GatewayPageURL = apiResponse.GatewayPageURL

                paymentsCollection.insertOne({
                    ...order,
                    price: orderedTour.totalCost,
                    transactionId,
                    currency: 'BDT',
                    paid: false
                });
                return res.send({ url: GatewayPageURL });
            });
        })


        //payment successful
        app.post('/payment/success', async (req, res) => {

            const { transactionId, tourId } = req.query;

            const tour = await upcomingToursCollection.findOne({ _id: ObjectId(tourId) })

            const result = await paymentsCollection.updateOne({ transactionId },
                {
                    $set: {
                        paid: true,
                        paidAt: new Date()
                    }
                })

            if (result.modifiedCount > 0) {
                var updateTravelerNum = tour.leftTravelers + 1;

                res.redirect(`http://localhost:3000/payment/success?transactionId=${transactionId}`)
            }

            const query = { _id: ObjectId(tourId) };

            const updateTour = await upcomingToursCollection.updateOne({ _id: ObjectId(tourId) },
                {
                    $set: {
                        leftTravelers: updateTravelerNum
                    }
                }
            )
        })

        //successful order summery api
        app.get('/payment/success/:id', async (req, res) => {
            const { id } = req.params;

            const tour = await paymentsCollection.findOne({ transactionId: id })

            res.send(tour)
        })


        //My Tours/Recent events api
        app.get('/my-tours', async (req, res) => {
            const { email } = req.query;
            const query = { userEmail: email }

            const result = await paymentsCollection.find(query).toArray();

            res.send(result);



            // const posts = await postsCollection.find(query).sort({ time: -1 }).toArray();
            // res.send(posts)
        })


        //view agency profile by user
        app.get('/agencyProfile/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const agencyProfile = await createdAgencyCollection.findOne(query);
            res.send(agencyProfile)
        });

        //agency timeline posts
        app.get('/agency/:email', async (req, res) => {
            const email = req.params.email;
            const query = { agencyEmail: email };
            const posts = await upcomingToursCollection.find(query).toArray();
            res.send(posts)
        });


        //view user profile
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            res.send(user)
        })


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




        //Important delete
        // app.get('/delete-data', async(req, res) => {
        //     const result = await upcomingToursCollection.deleteMany({details: 't'})
        //     console.log('result', result);
        //     res.send(result);
        // })
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