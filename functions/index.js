const express = require("express");
// const { admin, db } = require("./utils/admin");
// const admin = require("firebase-admin");
const cookieParser = require("cookie-parser");
const https = require("https");
const fs = require("fs");
const cors = require("cors");

const app = express();

app.use(express.json({limit: '100mb'}));
app.use(express.urlencoded({limit: '100mb'}));

const path = require("path");
app.use(cookieParser());
const functions = require("firebase-functions");
// const express = require("express"); //initializaing the app
var bodyParser = require("body-parser");
//const firebaseConfig = require("./utils/config");
const firebase = require("firebase");
const admin = require("firebase-admin");

const PORT = process.env.port || 4000;

// var options = {
//   key: fs.readFileSync("../keys/key.pem"),
//   cert: fs.readFileSync("../keys/cert.pem"),
// };

var key =
  "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCK4aZ6X2lKtNpE\n5AuyCMSJRaRn+9JkZd7l9zuuwZour2GnnLe8PjncWFAjuHMflXnOpnPl8YDET5Hm\n9jMwGmRi30iFn3tz4tMRSs00hkhAISMKAmhuZEiu/ijyWwsSv6RBCsDSMMhatVxV\ncVMdCkUzafsdKwBqVpI2zO5jYTOfS5T+C46ooN3ByZ/EsNGAgI9TboUk64M2CMBL\n7/A6t0eSKzeVT5iLTYEx1/OC8Ao81v6+TkTAki9df76ZwPZGsC9Hy5sgtbdgK8Av\njX92k5OynxIU98EXMutrxoYM1CXp3QWT5UVwC8x6XLRMBE1PoRE7lPqUH1O/YtHi\n4q+Ilcs9AgMBAAECggEABqkRudavjwSjXyBsqyoeetLbMp1yFpyIFxFHTHc+dLS2\ngzpR2XZGghm+JihnZQFfKRj0f/eYDFIglioChHEPlWpN6RKf8gvTwYWL19QEzQaJ\nzqYU6g5nKfVIc28IVerY7sGcQ7hRM4B1ICfiK4ddkDyp7VktmOvz8Src1+lGd4Iv\nWR2DMKv8d9zlVMJBTvd0rwZz208sILKBka8g0D2z4r4zjcc3Au+fYu+Yy0XGXAHp\njtJeR0Ta5Sy4bLA144d9dDwtr9ZkQBRFvnagEQ1FWq2qoZWPEDVdC4aHciNYhzLm\nikIPXbTvtuzozmvsQzGtwqUZfUwVH0KZ7BtBnumO5QKBgQDAeO8BQMmbIOc2KWIE\naWt/zbWi9pEPRv3Nfsj/hVSGVcQNGs8H23DCG8vODjGH1A/B+e2ygtRcMOA6H6eN\nzYeEf7GRCFl+jvXQvdZc1sWhkCoWRHclaOv9C6C8Q0ij5iug50073+WTO18Lj4O/\nbQCj95ihjzP3t2HYyGPDt3YeowKBgQC4uISz/5HFc2e7VHqymb+lrbQWaRO3yv1n\n6YWLre6Dn3Cr59P87D9GkyhE00MkMDqwSTrFGJbL7DoP+A1ObiHTnGR96r3K+695\ncYW7nX8Rf08qTW63uAQzx96FZUvCUPRy1W7vb7UN2BFPhUzwrPSRuqvIKtQxfGtq\nGYD6ykRsnwKBgBYSB/4RysxyEnFAf4/X8s697PUZ5vpkfpgA0NWUGWQqE4gZKeJR\nxHVNsKoZMI7Nv1zT5vDQVb+Yjy27EYCOL9r+tYLW/UQo6oEcM6eDrTfgiyLwiOUO\nSflDSxQrdvnsW9Zgj5etDes7JKPzufzKaAdlTehAvonKSnsMR3xa3j2XAoGAUZSs\nhxKIPrwJRCK7TcW5bmKY9ozRuIpeAFaSNG5MuLTh/goVBc8Q4wp67mqfbIwgX1r4\nKbQCZW2e9w6GUe0x41Nezn2t9MfTZ79LYODeDcw8GmK4U0tiD7xl+mQSYW9/hnfc\n1sJvI/4ZJxWoNWMtYG8hDvZbYL+icOlynVBXh+ECgYEAt6bHKDMsT1e59bs5F5e6\nMHgkg3s6AjIU49GBwQBUHS+YD0RB0pqB33Dnp0GFyXG0AjsMSyQ1NlJ6YfALUGWf\nlrg0XFGMRGfWPeqKX4R3j3NhyeZx1MWIu9ZU+7AB5i1AwzanH41i3EQ69pEaix8k\n+VPn1r0Ct00EPDRXzLjXwqQ=\n-----END PRIVATE KEY-----\n";
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: "jozekoapp",
    client_email: "firebase-adminsdk-hwab4@jozekoapp.iam.gserviceaccount.com",
    private_key: key.replace(/\\n/g, "\n"),
  }),
});
//admin.initializeApp();
const db = admin.firestore();

const config = {
  apiKey: "AIzaSyDGPVvhxIOj4g4OnM2xMRC39Rosl0KAJtw",
  authDomain: "jozekoapp.firebaseapp.com",
  projectId: "jozekoapp",
  storageBucket: "jozekoapp.appspot.com",
  messagingSenderId: "882620001838",
  appId: "1:882620001838:web:bb6b130dac874504d6f9bf",
  measurementId: "G-H74YSDW7JH",
};
firebase.initializeApp(config);
// Initializing Firebase

require("dotenv").config();
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json({ limit: "50mb" }));
app.use(cors());
// const stripe = require("stripe")(process.env.STRIPE_SECRET_TEST);
const nunjucks = require("nunjucks");
const stripe = require("stripe")(
  "sk_test_51IqHJuDP646AUiZa8yFZX7mkvW5oriMDMZ11ulbV8E6qcIqYdEERO2f6JkXz9JoIAiOtXmcPH5wKlOc0nyNKeHeS00HSO1fwGa"
);

app.set("view engine", "html");
// when res.render works with html files, have it use nunjucks to do so
app.engine("html", nunjucks.render);
nunjucks.configure("views", { noCache: true });
app.use(express.static(__dirname));

app.get("/stripe-form-5", function (req, res, next) {
  res.render("stripeFormStyled5", { title: "Stripe Form Title" });
});
app.get("/stripe-form-30", function (req, res, next) {
  res.render("stripeFormStyled30", { title: "Stripe Form Title" });
});
app.get("/stripe-form-100", function (req, res, next) {
  res.render("stripeFormStyled100", { title: "Stripe Form Title" });
});

//google pay payment button
app.get("/google-pay-form", function (req, res, next) {
  res.render("googlePay", { title: "Google Pay Form Title" });
});

//STRIPE PRODUCTS PAYMENTS
// const envFilePath = path.resolve(__dirname, "./.env");
// const env = require("dotenv").config({ path: envFilePath });
// if (env.error) {
  // throw new Error(
    // `Unable to load the .env file from ${envFilePath}. Please copy .env.example to ${envFilePath}`
  // );
// }

// app.use(express.static(process.env.STATIC_DIR));
app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    // Let's compute it only when hitting the Stripe webhook endpoint.
    verify: function (req, res, buf) {
      if (req.originalUrl.startsWith("/webhook")) {
        req.rawBody = buf.toString();
      }
    },
  })
);

app.get("/sub", (req, res) => {
  const filePath = path.resolve(process.env.STATIC_DIR +  "/index.html");
  res.sendFile(filePath);
});

// Fetch the Checkout Session to display the JSON result on the success page
app.get("/checkout-session", async (req, res) => {
  const { sessionId } = req.query;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  res.send(session);
});

app.post("/create-checkout-session", async (req, res) => {
  // const domainURL = `http://localhost:4000`;
  const domainURL = process.env.DOMAIN;
  const { priceId } = req.body;

  // Create new Checkout Session for the order
  // Other optional params include:
  // [billing_address_collection] - to display billing address details on the page
  // [customer] - if you have an existing Stripe Customer ID
  // [customer_email] - lets you prefill the email input in the form
  // For full details see https://stripe.com/docs/api/checkout/sessions/create
  try {

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // ?session_id={CHECKOUT_SESSION_ID} means the redirect will have the session ID set as a query param
      success_url: `${domainURL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domainURL}/canceled.html`,
    });

    res.send({
      sessionId: session.id,
    });
  } catch (e) {
    res.status(400);
    return res.send({
      error: {
        message: e.message,
      },
    });
  }
});

app.get("/setup", (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    basicPrice: process.env.BASIC_PRICE_ID,
    proPrice: process.env.PRO_PRICE_ID,
    professionalPrice: process.env.PROFESSIONAL_PRICE_ID,
  });
});

app.post("/customer-portal", async (req, res) => {
  // For demonstration purposes, we're using the Checkout session to retrieve the customer ID.
  // Typically this is stored alongside the authenticated user in your database.
  try{

    const { sessionId } = req.body;
    const checkoutsession = await stripe.checkout.sessions.retrieve(sessionId);
    const products = await stripe.products.list({
      limit: 3,
    });
    console.log("saraaaaaaaaaaa",products);
    // This is the url to which the customer will be redirected when they are done
    // managing their billing with the portal.
    const returnUrl = process.env.DOMAIN;
    

    const price = await stripe.prices.create({
      unit_amount: 10000,
      currency: 'usd',
      recurring: {interval: 'month'},
      product: 'prod_JTDmZlWqyLyxNu',
    });



    const portalsession = await stripe.billingPortal.sessions.create({
      customer: checkoutsession.customer,
      return_url: returnUrl,
    });
  
    res.send({
      url: portalsession.url,
    });
  }
  catch (e) {
    res.status(400);
    return res.send({
      error: {
        message: e.message,
      },
    });
  }
});

// Webhook handler for asynchronous events.
app.post("/webhook", async (req, res) => {
  let data;
  let eventType;
  // Check if webhook signing is configured.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event;
    let signature = req.headers["stripe-signature"];

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`⚠️  Webhook signature verification failed.`);
      return res.sendStatus(400);
    }
    // Extract the object from the event.
    data = event.data;
    eventType = event.type;
  } else {
    // Webhook signing is recommended, but if the secret is not configured in `config.js`,
    // retrieve the event data directly from the request body.
    data = req.body.data;
    eventType = req.body.type;
  }

  if (eventType === "checkout.session.completed") {
    console.log(`🔔  Payment received!`);
  }

  res.sendStatus(200);
});

app.post("/stripe-information-5", function (req, res, next) {
  console.log("stripe information received: ", req.body);
  stripe.charges
    .create({
      amount: 500,
      currency: "usd",
      source: req.body.stripeToken,
      capture: false, // note that capture: false
    })
    .then((response) => {
      stripe.charges
        .capture(response.id)
        .then((res) => res)
        .catch((err) => err);
      res.json("Succeed");
      return;
      // do something in success here
    })
    .catch((error) => {
      res.json(error);
      return;
      // do something in error here
    });
});
app.post("/stripe-information-30", function (req, res, next) {
  console.log("stripe information received: ", req.body);
  stripe.charges
    .create({
      amount: 3000,
      currency: "usd",
      source: req.body.stripeToken,
      capture: false, // note that capture: false
    })
    .then((response) => {
      stripe.charges
        .capture(response.id)
        .then((res) => res)
        .catch((err) => err);
      res.json("Succeed");
      return;
      // do something in success here
    })
    .catch((error) => {
      res.json(error);
      return;
      // do something in error here
    });
});
app.post("/stripe-information-100", function (req, res, next) {
  console.log("stripe information received: ", req.body);
  stripe.charges
    .create({
      amount: 10000,
      currency: "usd",
      source: req.body.stripeToken,
      capture: false, // note that capture: false
    })
    .then((response) => {
      stripe.charges
        .capture(response.id)
        .then((res) => res)
        .catch((err) => err);
      res.json("Succeed");
      return;
      // do something in success here
    })
    .catch((error) => {
      res.json(error);
      return;
      // do something in error here
    });
});

app.post("/google-pay-information", function (req, res, next) {
  console.log("google pay information received: ", req.body);
  // return res.json("Done");

  stripe.charges
    .create({
      amount: 500,
      currency: "usd",
      source: req.body.stripeToken,
      capture: false, // note that capture: false
    })
    .then((response) => {
      stripe.charges
        .capture(response.id)
        .then((res) => res)
        .catch((err) => err);
      res.json("Succeed");
      return;
      // do something in success here
    })
    .catch((error) => {
      res.json(error);
      return;
      // do something in error here
    });
});

app.post("/stripe/charge", cors(), async (req, res) => {
  console.log("stripe-routes.js 9 | route reached", req.body);
  let { amount, id } = req.body;
  console.log("stripe-routes.js 10 | amount and id", amount, id);
  try {
    const payment = await stripe.paymentIntents.create({
      amount: amount,
      currency: "USD",
      description: "Your Company Description",
      payment_method: id,
      confirm: true,
    });
    console.log("stripe-routes.js 19 | payment", payment);
    res.json({
      message: "Payment Successful",
      success: true,
    });
  } catch (error) {
    console.log("stripe-routes.js 17 | error", error);
    res.json({
      message: "Payment Failed",
      success: false,
    });
  }
});

const {
  signIn,
  signUp,
  follow,
  posts,
  //viewNotification,
  about,
  goLive,
  postsLike,
  logOut,
  //setFavourites,
  quitLive,
  liveComment,
  dailySub,
  weeklySub,
  monthlySub,
  profilePic,
  postsComments,
  emojiReact,
  //msging,
  msgSeen,
  msgingget,
  //schdulepost,
  schdulelive,
  callsent,
  callrecieved,
  callcancel,
  callsenderend,
  //verifyemail,
  userView,
  NotificationStatus,
  story,
  favPosts,
  postsShare,
  locationTag,
  musicTag,
  fetchusercollections,
  fetchfavouritepost,
  //fetchother,
  //changeName,
  PostShareAsMessage,
  friendsTag,
  //isPrivate,
  //isNotPrivate,
  liveViewsCount,
  getUserID,
  getUsername,
  getFullName,
  fetchAnyOtheInfo,
  getEmail,
  getProfilePic,
 // test,
  //liveEmojiReact,
  //getSinglePost,
  getAbout,
  getisPrivate,
  getPostCount,
  getFollowingCount,
  getFollowersCount,
  resetPassword,
  getPostData,
  getAllPosts,
  EditUserData,
  //updateemail,
  favUser,
  favUserGet,
  getFollowingData,
  editPrivateStatus,
  promotePost,
  getNotifications,
  storyReply,
  unfollow,
  schedulepost,
  getUserData,
  postSeen,
  //stripePay,
  messaging,
  addCardAndGenerateToken,
  chargeCardUsingToken,
  refundUsingStripeId,
  postDelete,
  editPost,
} = require("./handlers/auth");

// app.use(bodyParser.json({
//   limit: '100mb'
// }));

// app.use(bodyParser.urlencoded({
//   limit: '100mb',
//   parameterLimit: 100000,
//   extended: true 
// }));

app.use(express.json());
app.use(cookieParser());

function savecookie(idtoken, res) {
  const expiresIn = 60 * 60 * 24 * 5 * 1000;
  admin
    .auth()
    .createSessionCookie(idtoken, { expiresIn })
    .then(
      (sessionCookie) => {
        const options = { maxAge: expiresIn, httpOnly: true, secure: true };
        admin
          .auth()
          .verifyIdToken(idtoken)
          .then(function (decodedClaims) {
            res.cookie("session", sessionCookie, options);
            res.redirect("/success");
          });
      },
      (error) => {
        res.status(401).send("UnAuthorised Request");
      }
    );
}

function checkCookie(req, res, next) {
  const sessionCookie = req.cookies.session || "";
  console.log(sessionCookie);
  admin
    .auth()
    .verifySessionCookie(sessionCookie, true)
    .then((decodedClaims) => {
      req.decodedClaims = decodedClaims;
      next();
    })
    .catch((error) => {
      // Session cookie is unavailable or invalid.
      // Force user to login.
      res.redirect("/");
    });
}

// MULTER
const multer = require("multer");

//var storage = multer.memoryStorage();
//var upload = multer({ storage: storage });
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    console.log("oyeee", file);
    cb(null, file.fieldname + Date.now());
  },
});

//const mid = upload.single("display");

app.post("/upload", (req, res, next) => {
  const upload = multer({ storage }).single("display");
  console.log(upload);
  upload(req, res, function (err) {
    if (err) {
      return res.send(err);
    }

    let image_url = undefined;
    console.log("file uploaded to server");

    if (req.file) {
      const cloudinary = require("cloudinary").v2;
      cloudinary.config({
        cloud_name: "dyvreufhh",
        api_key: "168554544323196",
        api_secret: "iwL_ygGy-avkypHeLH9mY2L8rmM",
      });

      const path = req.file.path;
      const uniqueFilename = new Date().toISOString();

      cloudinary.uploader.upload(
        path,
        { public_id: `DisplayPics/${uniqueFilename}`, tags: `DisplayPics` }, // directory and tags are optional
        function (err, image) {
          if (err) return res.send(err);
          console.log("file uploaded to Cloudinary");

          var fs = require("fs");
          fs.unlinkSync(path);

          image_url = image.secure_url;
          res.json(image);
        }
      );
    }

    // SEND FILE TO CLOUDINARY
  });
});

app.post("/register", signUp); //VERIFY EMAIL FIRST

app.post("/sessionLogin", (req, res) => {
  const idToken = req.cookies["id_token"];

  //const csrfToken = req.body.csrfToken;
  // Guard against CSRF attacks.
  // if (csrfToken !== req.cookies.csrfToken) {
  //   res.status(401).send("UNAUTHORIZED REQUEST!");
  //   return;
  // }
  // Set session expiration to 5 days.
  const expiresIn = 60 * 60 * 24 * 5 * 1000;
  // Create the session cookie. This will also verify the ID token in the process.
  // The session cookie will have the same claims as the ID token.
  // To only allow session cookie setting on recent sign-in, auth_time in ID token
  // can be checked to ensure user was recently signed in before creating a session cookie.
  admin
    .auth()
    .createSessionCookie(idToken, { expiresIn })
    .then(
      (sessionCookie) => {
        // Set cookie policy for session cookie.
        const options = { maxAge: expiresIn, httpOnly: true, secure: true };
        res.clearCookie("id_token");
        res.cookie("session", sessionCookie);
        // console.log(res);
        res.status(200).send({idToken});
      },
      (error) => {
        res.status(401).send("UNAUTHORIZED REQUEST!");
      }
    );
});

//google routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/login.html");
});

app.get("/logoutt", (req, res) => {
  res.clearCookie("__session");
  res.redirect("/");
});

app.get("/success", checkCookie, (req, res) => {
  res.sendFile(__dirname + "/success.html");
  console.log("UID of Signed in User is" + req.decodedClaims.uid);
  // You will reach here only if session
  // is working Fine
});
app.get("/savecookie", (req, res) => {
  const Idtoken = req.query.idToken;
  savecookie(Idtoken, res);
});

//----------------------------

app.get("/getUserdata", getUserData); //gets all user data who is logged in
app.get("/getUserID", getUserID);
app.get("/getFullName", getFullName);
app.get("/getUsername", getUsername);
app.get("/getEmail", getEmail);
app.get("/getabout", getAbout);
app.get("/getIsPrivate", getisPrivate);
app.get("/getPostCount/:totalPosts", getPostCount);
app.post("/edituserdata", EditUserData);
app.post("/favuser/:id", favUser); 
app.get("/favuserGet/:id", favUserGet); 
app.get("/getfollowingdata", getFollowingData); 
app.get("/getnotifications", getNotifications); 
app.get("/getPostData/:postID", getPostData); //get a post data of a logged in user

app.get("/getFollowingCount/:totalFollowing", getFollowingCount);
app.get("/getFollowersCount/:totalFollowers", getFollowersCount);
//app.get("/getpost/:id/:postID", getSinglePost);
app.get("/getAllPosts", getAllPosts);
app.get("/getProfilePic/:id/:profilePicId", getProfilePic); //:id is users id and profilePicId is the id of the profile pic id of that user

app.post("/login", signIn);
app.post("/logout", logOut);
app.post("/follow/:id", follow); //size
app.post("/unfollow/:id", unfollow);
//app.post("/like/:id", postsLike);
app.post("/goLive", goLive);  
app.post("/liveComment/:id/:liveID", liveComment); //emojis react are now in this api
app.post("/liveViewsCount/:id/:liveID", liveViewsCount);
// app.post("/liveEmoji/:id/:liveID", liveEmojiReact);
app.post("/quitLive/:id", quitLive); // user ID
//app.post("/live/:id", Live);
app.post("/posts", posts);
app.post("/editPost/:postId", editPost);
app.post("/deletePost/:postId", postDelete); //delete post
app.post("/postsComments/:id/:pID", postsComments); //7
app.post("/postsLike/:id/:pID", postsLike); //public account
app.post("/postsShare/:id/:pID", postsShare);
app.post(
  "/PostShareAsMessage/:id/:authorID/:postID/:receiverID",
  PostShareAsMessage
);
app.post("/Location/:id/:pID", locationTag);
app.post("/musicTag/:id/:pID", musicTag);
//private
app.put("/privateStatus", editPrivateStatus);

app.post("/friendsTag/:id/:tagID/:pID", friendsTag);
app.post("/pic", profilePic);
//story
app.post("/story/:id", story); //
app.post("/storyReply/:id", storyReply);
//subsciption
app.post("/promotePost/:id", promotePost);
app.post("/dailySub/:id", dailySub);
app.post("/weeklySub/:id", weeklySub);
app.post("/monthlySub/:id", monthlySub);

app.post("/schedulepost/:id/:minute/:hour/:date/:month", schedulepost); //6
app.post("/schdulelive/:id/:minute/:hour/:date/:month", schdulelive); 
app.post("/callsent/:id", callsent);
app.post("/callrecieved/:id", callrecieved);
app.post("/callcancel/:id", callcancel);
app.post("/callsenderend/:id", callsenderend); //call not being picked duration
app.post("/resetpassword", resetPassword); //2

//fetching data
app.get("/fetchusercollections/:col", fetchusercollections);
app.get("/fetchother/:id/:col", fetchAnyOtheInfo);
app.get("/fetchfavouritepost", fetchfavouritepost);



app.post("/view/:id/:pID", postSeen);
app.post("/notification/:id/:docID", NotificationStatus);
app.post("/viewUser/:id", userView);
app.post("/message/:id", messaging);
app.get("/messageSeen/:id/:msgID/:msgID2", msgSeen);
app.post("/messageEmoji/:id/:msgID", emojiReact);
app.post("/about", about);
//FOLLOWERS POST shown
//app.post("/favourite/:id", setFavourites);
app.post("/favPosts/:id/:postID", favPosts); //4
app.post("/msgingget/:id", msgingget);

//STRIPE API'S
app.post("/generate-stripe-token", addCardAndGenerateToken);
app.post("/deduct-amount-card", chargeCardUsingToken);
app.post("/refund-amount", refundUsingStripeId);
//app.post("/upload", imgUpload);
app.get("/get", (req, res) => {
  res.send("hello");
});

// var key =
//   "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCsdGPJDZ3xxiS+\naDbumyiX3E/jyiGfOejkhJOjXIhAou2WWCmYyEjDy72lEwV1TkkRUjMLOH56mW/G\nYY06xm07wYSrt+dFzWt3t/f/PIJ54Fb2pLMan0uQRYE9asTLT+GMMq5d7ok7ZixG\nTiafZdy0U3VX8f8yljzeHFHv7cwKcRpKurjjjAul5jikJrhlcEFaFc5nw+iS67DG\nIY7wCNo6tITGZW7PEgDXUQtY24/Wxoik9NkLboa5QsvPqDLbeTfi/LBF6S4++9G9\n4duyB1WLBu4Ra93pVabBr0iJhTMJoGZ0IGcEGQ6mQ3WzgsX8wLvu/QY2LmIFtURh\nlW3dQFrdAgMBAAECggEACD0AJlLg9HORfkoWs7PUTtresyRNEmDvE/mUXvW06ZeO\n74NzK0IIHdheDSR5OoccnPf3CcZvXlZ1nT28RC5F+hiOyLA+m1pKk7vFXFtM5VsW\n9G3eQ3uQHcqAN8mhsI+2l9607zZNtnl1TH9/v1Ybor6o6KReG1HLgxXJwUM0H9x+\ntPev9PgQeTOGLnct8hW/guW5G0mw4Fl03foXu0z2SSz4++JQniWpQ8hvnNG9xhWM\nHN2zZi5NmK2SY/IXsAYpePtaGUi10RniDyGSdSRTSRGgN9gGwpQXnjh8fsgtoAWv\nVjccjuXCd6D0P7q0b0qLUEJYgmeVPvvhehtlqfFWIQKBgQDgulvMjCjcb+Da6ksY\nv3wEJNqohx5wz3QOQ7qh1h+vFvIrXu89sJyVVDOpWEU4lfjwKcwMYLbMNUVYm3/+\neJBcvzJ5IeiAb7ww2rppef7fbBc7HbGYOr8avrCZfzhADwqQlgcVG20o2patXQFv\nITdqP/lCcWCjH6INeO8s31m1vQKBgQDEc9zAlPVKdZ4PVI6K6yK81prBtX0Up9KL\neev39v/0Z3azCQjIuQqoFmf8Ukl4SCgT9c75cgOwtGy7lrtMEc53FT/QWF8IYn/I\ntTrRe7xMjLgc+AAiwf/+PRVl5VjVcZNVISyyig7+MUevPXeTKbW2HNvrxkSbGUCe\nxw1sxaS7oQKBgQC/tbtCT/87riWAG4dc4V2Gm3n9cudBDXjQAm9gSC5XS5fj7+Tg\nF548tcwslyTWFPp8xutPU+IdawRxhpY2G9vrgyAnvgl+J9O/SZjlCjGnn6phv/8V\nAmitBCfbinAOFcbJeXMpSnBg/bi0xDbI+ukvNswJJnduMTopjBVdjlwVcQKBgFFj\n70GadUW0FRgk4CmN4YZ7IwK+PmQgY4qFqM3C96g6dWMXixweDdw17D8NmILM4k3i\nuS1/nyfGmIXfnRmXBwMvOpEHC9hddrOg4g2IRisw4daeqO+9kGG0zPi6XGOR+oh6\nhhoyOKP3pstjm/bMgQxCSJsWObZIcA1YSqeV+voBAoGBANMZHpzzne56roA2f34p\n2TvGDH6t0kE9cFq5d/tch26pUlt2ipoMubUoMAANJmtz5NI+7SU3rJ0SM6ztkW9/\n0NLgoNUjXJmN/vSYXr7cOJsGSx8ehire0qruNe5bB23iPQm/FcjdXzdZTeUn6/MT\nVJivgXcQyTbUjZqx2vTW5079\n-----END PRIVATE KEY-----\n";

// admin.initializeApp({
//   credential: admin.credential.cert({
//     private_key: key.replace(/\\n/g, "\n"),
//     client_email: "firebase-adminsdk-6uwv0@jozeko-24.iam.gserviceaccount.com",
//     project_id: "jozeko-24",
//   }),
// });

// https
//   .createServer(
//     {
//       key: fs.readFileSync("server.key", "utf8"),
//       cert: fs.readFileSync("server.cert", "utf8"),
//     },
//     function () {
//       console.log("listening on port 4000!" + " Go to https://localhost:4000/");
//     }
//   )
//   .listen(4000);

// var httpsServer = https.createServer(
//   {
//     key: fs.readFileSync("key.key", "utf8"),
//     cert: fs.readFileSync("certificate.crt", "utf8"),
//   },
//   app
// );
// httpsServer.listen(8443);

app.listen(PORT, function () {
  console.log("listening on port " + PORT + " Go to https://localhost:4000/");
});
exports.api = functions.https.onRequest(app);
