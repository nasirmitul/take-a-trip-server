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
        const personalizedTourCollection = client.db('TakeATrip').collection('personalizeTour');

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

        //search results
        app.get('/search', async (req, res) => {
            const data = req.query.searchData;

            const query = { name: new RegExp(data, 'i') }

            const searchResult = await usersCollection.find(query).toArray();
            res.send(searchResult)
        })

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

        //add and remove followers
        app.put('/follow/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }

            const followerInfo = req.body;

            const myEmail = followerInfo.followByEmail;
            console.log('mm', myEmail);
            const myFollowQuery = { email: myEmail }

            const meFollowing = {
                $push: {
                    following: {
                        followingEmail: followerInfo.byFollowEmail,
                        followingName: followerInfo.byFollowName,
                        followingImage: followerInfo.byFollowImage,
                        followingTime: followerInfo.followTime
                    }
                }
            }

            const toFollow = {
                $push: {
                    followers: followerInfo
                }
            }

            const result = await usersCollection.updateOne(query, toFollow)

            const myFollowResult = await usersCollection.updateOne(myFollowQuery, meFollowing)

            res.send(result);
        })


        app.put('/unfollow/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }

            const followerInfo = req.body;

            const myEmail = followerInfo.followByEmail;
            const myUnFollowQuery = { email: myEmail }

            const meUnFollowing = {
                $pull: {
                    following: {
                        followingEmail: followerInfo.byFollowEmail
                    }
                }
            }

            const toUnFollow = {
                $pull: {
                    followers: {
                        followByEmail: followerInfo.followByEmail
                    }
                }
            }

            const result = await usersCollection.updateOne(query, toUnFollow)

            const myFollowResult = await usersCollection.updateOne(myUnFollowQuery, meUnFollowing)

            res.send(result);
        })


        //follower api
        app.get('/follower/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }

            const follower = await usersCollection.findOne(query)
            res.send(follower.followers)
        })

        //following api
        app.get('/following/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email }

            const following = await usersCollection.findOne(query)
            res.send(following.following)
        })


        //upcoming tour api for all upcoming data
        app.get('/upcomingTours', async (req, res) => {
            const query = {}
            const cursor = upcomingToursCollection.find(query);
            const upComingTourData = await cursor.toArray();
            const count = await upcomingToursCollection.estimatedDocumentCount();
            res.send({ count, upComingTourData });
        })

        //single upcoming tour api
        // app.get('/tour-details/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const query = {_id : ObjectId(id)}
        
        //     const result = await upcomingToursCollection.findOne(query)
        //     // const cursor = await upcomingToursCollection.find(query).toArray();

        //     res.send(result);
        // })

        //upcoming tour api for agency email
        app.get('/upcomingTours/:email', async (req, res) => {
            const email = req.params.email;
            const query = { agencyEmail: email }
            const cursor = upcomingToursCollection.find(query);
            const upComingTourData = await cursor.toArray();
            res.send(upComingTourData);
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
        app.get('/upcoming-tours/:id', async (req, res) => {
            const id = req.params.id;
            console.log('id', id);
            const query = { _id: ObjectId(id) };
            const upcomingTour = await upcomingToursCollection.findOne(query);
            res.send(upcomingTour)
        });

        //personalized tours
        app.post('/personalized-tours', async (req, res) => {

            const personalizeTour = req.body;
            const result = await personalizedTourCollection.insertOne(personalizeTour)
            res.send(result);
        })

        //personalized tours api for agency
        app.get('/personalized-tours/agency/:email', async (req, res) => {
            const email = req.params.email;
            const query = { agencyEmail: email }
            const result = await personalizedTourCollection.find(query).toArray();
            res.send(result);
        })

        //personalized tours api for user
        app.get('/personalized-tours/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await personalizedTourCollection.find(query).toArray();
            res.send(result);
        })

        //update personalized tours
        app.put('/personalized-tours/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const updatedData = req.body;

            const tourData = {
                $set: {
                    status: true,
                    amount: updatedData.amount
                }
            }

            const result = await personalizedTourCollection.updateOne(query, tourData)
            res.send(result);
        })

        //cancel personalize tour by user
        app.delete('/personalized-tours/:id', async(req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id)}
            const result = await personalizedTourCollection.deleteOne(query)
            console.log('result', result);
            res.send(result);
        })

        //Payment for personalize tour
        app.post('/payment', async (req, res) => {
            const order = req.body;

            const orderedTour = await personalizedTourCollection.findOne({ _id: ObjectId(order.tour) })

            const transactionId = new ObjectId().toString()

            const data = {
                total_amount: orderedTour.amount,
                currency: 'BDT',
                tran_id: transactionId, // use unique tran_id for each api call
                success_url: `http://localhost:5000/payment/success/personalize?transactionId=${transactionId}&tourId=${order.tour}`,
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
                    price: orderedTour.amount,
                    transactionId,
                    currency: 'BDT',
                    paid: false
                });
                return res.send({ url: GatewayPageURL });
            });
        })


        //payment successful for personalize tour
        app.post('/payment/success/personalize', async (req, res) => {

            const { transactionId, tourId } = req.query;

            const tour = await upcomingToursCollection.findOne({ _id: ObjectId(tourId) })



            const paymentInfo = await paymentsCollection.findOne({ transactionId })


            const result = await paymentsCollection.updateOne({ transactionId },
                {
                    $set: {
                        paid: true,
                        paidAt: new Date()
                    }
                })

            if (result.modifiedCount > 0) {
                res.redirect(`http://localhost:3000/payment/success?transactionId=${transactionId}`)
            }

            const updateTour = await personalizedTourCollection.updateOne({ _id: ObjectId(tourId) },
                {
                    $set: {
                        payment: true
                    }
                }
            )
        })



        //Payment for upcoming tour
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


        //payment successful for upcoming tour
        app.post('/payment/success', async (req, res) => {

            const { transactionId, tourId } = req.query;

            const tour = await upcomingToursCollection.findOne({ _id: ObjectId(tourId) })

            // console.log('tour data', tour);


            const paymentInfo = await paymentsCollection.findOne({ transactionId })

            // console.log('paymentInfo', paymentInfo);
            const user = await usersCollection.findOne({ email: paymentInfo.userEmail })

            // console.log('user', user);

            const result = await paymentsCollection.updateOne({ transactionId },
                {
                    $set: {
                        paid: true,
                        paidAt: new Date()
                    }
                })

            if (result.modifiedCount > 0) {
                var updateTravelerNum = tour.leftTravelers + 1;

                console.log('tour.leftTravelers', tour.leftTravelers);
                console.log('updateTravelerNum', updateTravelerNum);

                res.redirect(`http://localhost:3000/payment/success?transactionId=${transactionId}`)
            }

            // const query = { _id: ObjectId(tourId) };

            const updateTour = await upcomingToursCollection.updateOne({ _id: ObjectId(tourId) },
                {
                    $set: {
                        leftTravelers: updateTravelerNum
                    }
                }
            )

            const updateUserTours = await usersCollection.updateOne(
                { email: user.email },
                {
                    $push: {
                        tours: paymentInfo
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

        //agency timeline posts api
        app.get('/agency/:email', async (req, res) => {
            const email = req.params.email;
            const query = { agencyEmail: email };
            const posts = await upcomingToursCollection.find(query).toArray();
            res.send(posts)
        });

        //agency reviews api
        app.get('/agency/reviews/:email', async (req, res) => {
            const email = req.params.email;
            const query = { agencyEmail: email };
            const review = await createdAgencyCollection.findOne(query);
            res.send(review.reviews)
        });

        //add agency ratings
        app.put('/review/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }

            const reviewInfo = req.body;

            const review = {
                $push: {
                    reviews: reviewInfo
                }
            }

            const result = await createdAgencyCollection.updateOne(query, review)

            res.send(result);
        })

        //view user profile
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            res.send(user)
        })

        //user tours api
        app.get('/user/tours/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const userTours = await usersCollection.findOne(query);

            res.send(userTours.tours)
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
        //     const result = await createdAgencyCollection.deleteMany({personalizedTours:[]})
        //     console.log('result', result);
        //     res.send(result);
        // })

        //Important update
        // app.get('/update-data', async (req, res) => {
        //     const result = await createdAgencyCollection.updateMany(
        //         {},
        //         {
        //             $set: {
        //                 personalizedTours : []
        //             }
        //         }
        //     )
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