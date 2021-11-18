const { admin, db, firebase } = require("../utils/admin");
var cron = require("node-cron");
const nodemailer = require("nodemailer");
const geofire = require("geofire-common");
const moment = require('moment')
const stripe = require("stripe")(
  "sk_test_51IqHJuDP646AUiZa8yFZX7mkvW5oriMDMZ11ulbV8E6qcIqYdEERO2f6JkXz9JoIAiOtXmcPH5wKlOc0nyNKeHeS00HSO1fwGa"
);
const { validateSignUPData, validateLoginData } = require("../utils/helpers");
const functions = require("firebase-functions");
const { v4: uuidv4, v5: uuidv5 } = require("uuid");
const multer = require("multer");
const { user } = require("firebase-functions/lib/providers/auth");
const { connect } = require("http2");
const { document } = require("firebase-functions/lib/providers/firestore");
const { nextTick } = require("process");
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
exports.signUp = async (req, res) => {
  const newUser = {
    isPrivate: false,
    Fname: req.body.Fname,
    Lname: req.body.Lname,
    username: req.body.username,
    email: req.body.email,
    DateOfBirth: req.body.dob,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
  };
  const { valid, errors } = validateSignUPData(newUser);
  if (!valid)
    //checking validation
    return res.status(400).json(errors);
  let token, userId;
  const snapshot = await db
    .collection("users")
    .where("Username", "==", newUser.username)
    .get();
  if (snapshot.empty) {
    db.collection("users")
      .where("Username", "==", newUser.username)
      .get()
      .then((doc) => {
        if (doc.exists) {
          return res.status(400).json({ handle: "The user id already taken" });
        } else {
          db.collection("users")
            .where("email", "==", newUser.email)
            .get()
            .then((doc) => {
              if (doc.exists) {
                return res
                  .status(400)
                  .json({ handle: "The user email already taken" });
              }
            });
          // firebase
          //   .auth()
          //   .sendSignInLinkToEmail(newUser.email, actionCodeSettings)
          //   .then(() => {
          //     // The link was successfully sent. Inform the user.
          //     // Save the email locally so you don't need to ask the user for it again
          //     // if they open the link on the same device.
          //     window.localStorage.setItem("emailForSignIn", email);
          //     // ...
          //   })
          //   .catch((error) => {
          //     var errorCode = error.code;
          //     var errorMessage = error.message;
          //     // ...
          //   });
          return firebase
            .auth()
            .createUserWithEmailAndPassword(newUser.email, newUser.password);
        }
      })
      .then((data) => {
        userId = data.user.uid;
        return data.user.getIdToken();
      })
      .then((idToken) => {
        token = idToken;
        const userCredentials = {
          userId,
          FirstName: req.body.Fname,
          LastName: req.body.Lname,
          Username: req.body.username,
          email: newUser.email,
          DateOfBirth: req.body.dob,
          createdAt: new Date().toISOString(),
          isPrivate: false,
          isOnline: true
        };
        return db.doc(`/users/${userId}`).set(userCredentials);
      })
      .then(() => {
        return res.status(201).json({ token });
      })
      .then(() => {
        var user = firebase.auth().currentUser;
        user
          .sendEmailVerification()
          .then(function () {
            console.log("Email send");
          })
          .catch(function (error) {
            console.log("Not sent");
          });
      })
      .catch((err) => {
        if (err.code === "auth/email-already-in-use") {
          return res.status(400).json({ email: "Email already exist!" });
        }
        if (err.code === "auth/username-already-in-use") {
          return res.status(400).json({ username: "Username already exist!" });
        }
        return res.status(500).json({ error: err.message });
      });
  } else {
    res.send("usename is already taken");
  }
};

exports.signIn = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password,
  };
  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password) //firebase signin method
    .then((data) => {
      if (firebase.auth().currentUser) { //emailVerified
        return data.user.getIdToken().then((idToken) => {
          admin
            .auth()
            .createSessionCookie(idToken, { expiresIn:  60 * 60 * 24 * 5 * 1000 })
            .then(
              (sessionCookie) => {
                res.status(200).send({idToken});
              },
              (error) => {
                res.status(401).send("UNAUTHORIZED REQUEST!");
              }
            );
        });
      } else {
        return res.send("User email is not Verified kindly verify it");
      }
    })
    .catch((err) => {
      if (err.code === "auth/wrong-password") {
        return res
          .status(403)
          .json({ message: "Wrong credentials, Please try again" });
      }
      console.log(err);
      return res.status(404).json({ error: err.code });
    });
};

exports.resetPassword = async (req, res) => {
  var auth = firebase.auth();
  auth
    .sendPasswordResetEmail(req.body.email)
    .then(function () {
      // Email sent.
      res.send("Email sent");
    })
    .catch(function (error) {
      // An error happened
      res.send("Please Try Again");
    });
};

exports.storyReply = (req, res) =>{
  var user = firebase.auth().currentUser;
  if(user){
    var tmp = db.collection("users").doc(user.uid);
    var tmp1 = db.collection("users").doc(req.params.id);
    tmp1.collection("Story").get().then((doc)=>{
      if(doc.size == 0){
        res.send("Story not found")
      }
      if(user.uid === tmp1.id){
        res.send("Can't reply to your own story")
      }
      else if(user.uid != req.params.id){
        tmp.get().then((userData)=>{

          doc.forEach((data)=>{
            tmp1.collection("Story").doc(data.id).collection("Replies").add({
              reply: req.body.reply,
              firstname: userData.data().FirstName,
              lastname: userData.data().LastName,
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            }).then(()=>{
              res.send("Reply sent")
            })
          })
        })
      }
    })
  }else{
    res.send("Not authorized")
  }
}

exports.getNotifications = async (req, res) => {
  var user = firebase.auth().currentUser;
  var arr = []
  if(user){
    var tmp = db.collection("users").doc(user.uid).collection("NotificationsTab");
    tmp.get().then((data)=>{
      if(data.size == 0){
        res.send("No notificaitons found")
      }
      data.forEach((docData)=>{
        arr.push(docData.data())
      })
      res.send(arr)
    })
  }
  else{
    res.send("Not authorized")
  }
}


exports.follow = async (req, res) => {
  var user = firebase.auth().currentUser;
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    if (tmp.id != user.uid) {
      const follow = tmp.collection("Followers");
      const fo = follow.doc(user.uid);

      var tmp1 = db.collection("users").doc(user.uid);
      const following = tmp1.collection("Following");

      const value = await db
        .collection("users")
        .doc(user.uid)
        .collection("Following")
        .doc(req.params.id)
        .get();

      if (value.exists) {
        console.log("User already followed");
        res.send("User already followed");
      } else {
        db.collection("users")
          .doc(user.uid)
          .collection("Following")
          .get()
          .then((snap) => {
            size = snap.size; // will return the collection size
            db.collection("users")
              .doc(user.uid)
              .collection("TotalFollowing")
              .doc(user.uid)
              .set({
                Total: size,
              });
          });

        db.collection("users")
          .doc(req.params.id)
          .collection("Followers")
          .get()
          .then((snap) => {
            size = snap.size; // will return the collection size
            db.collection("users")
              .doc(req.params.id)
              .collection("TotalFollowers")
              .doc(req.params.id)
              .set({
                Total: 0,
              });
          });

        db.collection("users")
          .doc(req.params.id)
          .collection("Followers")
          .doc(user.uid)
          .set(
            {
              FollowedBy: firebase.auth().currentUser.email,
            },
            { merge: true }
          )
          .then(function () {
            db.collection("users")
              .doc(user.uid)
              .get()
              .then((querySnapshot) => {
                var str1 = querySnapshot.data().FirstName;
                var str2 = querySnapshot.data().LastName;
                var result = str1.concat(" ", str2);
                var vi = "just followed you.";
                var Notification = result.concat(" ", vi);

                tmp
                  .collection("NotificationsTab")
                  .add({ Notification, Status: { Read: false }, Timestamp: admin.firestore.FieldValue.serverTimestamp()});
              });
            db.collection("users")
              .doc(req.params.id)
              .get()
              .then((value) => {
                db.collection("users")
                  .doc(user.uid)
                  .collection("Following")
                  .doc(req.params.id)
                  .set({
                    Following: value.data().email,
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("Following")
                  .get()
                  .then((snap) => {
                    size = snap.size; // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalFollowing")
                      .doc(user.uid)
                      .update({
                        Total: size,
                      });
                    console.log("size", size);
                  });

                db.collection("users")
                  .doc(req.params.id)
                  .collection("Followers")
                  .get()
                  .then((snap) => {
                    size = snap.size; // will return the collection size
                    db.collection("users")
                      .doc(req.params.id)
                      .collection("TotalFollowers")
                      .doc(req.params.id)
                      .update({
                        Total: size,
                      });
                  });
              });

            res.send("Document successfully updated!");
          })
          .catch(function (error) {
            // The document probably doesn't exist.
            res.send("Error updating document: ", error);
          });
      }
    } else {
      res.send("Not authorized");
    }
  }
};

//CREATING A POST

//var storage = multer.memoryStorage();
//var upload = multer({ storage: storage });
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + Date.now());
  },
});

exports.profilePic = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);
  
    if (tmp.id === user.uid) {
      const upload = multer({ storage }).single("display");
  
      upload(req, res, function (err) {
        if (err) {
          return res.send(err);
        }
  
        let image_url = null;
        console.log("file uploaded to server");
  
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
          { public_id: `ProfilePic/${uniqueFilename}`, tags: `ProfilePic` }, // directory and tags are optional
          function (err, image) {
            if (err) return res.send(err);
            console.log("file uploaded to Cloudinary");
  
            var fs = require("fs");
            fs.unlinkSync(path);
  
            image_url = image.secure_url;
            console.log(image_url);
            return tmp
              .collection("ProfilePic")
              .add(
                {
                  image_url: image_url,
                },
                { merge: true }
              )
              .then(function () {
                res.status(200).send("Document successfully updated!");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
            //res.json(image);
          }
        );
  
        // SEND FILE TO CLOUDINARY
      });
    } else {
      res.send("Not authorized");
    }
  }).catch(()=>{
    res.send("Wrong Id token")
  })
  
};

exports.promotePost = (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  var tmp = db.collection("users").doc(user.uid);
  if(!user || user.ya === null || !user.ya){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  
  else if (user.ya === idToken) {
    tmp.collection("posts").doc(req.params.id).get().then((promotedPost)=>{
      if(!promotedPost){
        res.send('Post not found')
      }
      if(req.body.time === 'Daily'){
        var today = new Date();
        var dayInMilliseconds = 3600 * 1000 * 24;
        today.setTime(today.getTime() + dayInMilliseconds);
        tmp.collection("posts").doc(req.params.id).update({prmotedTill:today, Package: 'Daily'}).then(()=>{
          res.send("Daily package activated")
        })
      }
      else if(req.body.time === 'Weekly'){
        var today = new Date();
        var weekInMilliseconds = 7 * 24 * 60 * 60 * 1000;
        today.setTime(today.getTime() + weekInMilliseconds);
        tmp.collection("posts").doc(req.params.id).update({prmotedTill:today, Package: 'Weekly'}).then(()=>{
          res.send("Weekly package activated")
        })
      }
      else if(req.body.time === 'Monthly'){
        var today = new Date();
        var monthInMilliseconds = 30 * 24 * 60 * 60 * 1000;
        today.setTime(today.getTime() + monthInMilliseconds);
        tmp.collection("posts").doc(req.params.id).update({prmotedTill:today, Package: 'Monthly'}).then(()=>{
          res.send("Monthly package activated")
        })
      }
    })
  }
}

exports.editPrivateStatus = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {

    console.log("object");
    var tmp = db.collection("users").doc(user.uid);
      tmp.get().then((userData)=>{
        if(userData.data().isPrivate === false){
          tmp.update({isPrivate: true}).then((data)=>{
            res.send('Account is set to private')
          })
        }
        else if(userData.data().isPrivate === true){
          tmp.update({isPrivate: false}).then((data)=>{
            res.send('Account is set to public')
          })
        }
      })
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
}

exports.locationTag = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    
      var tmp = db.collection("users").doc(req.params.id);
      var tmp1 = db.collection("users").doc(user.uid);
      if (user.uid === tmp.id) {
        console.log(user.uid);
        console.log(tmp.id);
  
        tmp1
          .collection("posts")
          .doc(req.params.pID)
          .update({ Location: req.body.location })
          .then(function () {
            res.send("Location tag added");
          });
      } else {
        res.send("Can't alter someone else post");
      }
  })
};

exports.getUserData = async (req, res) => {
  const idToken = req.headers.authorization;
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized User")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp =  db.collection("users").doc(user.uid);
    if (user.uid === tmp.id) {
      tmp.get().then((userdata)=>{
        tmp.collection("ProfilePic").get().then((profilepic)=>{
          if(profilepic.size <= 0){
            res.json({userId:user.uid, firstName: userdata.data().FirstName, lastName: userdata.data().LastName, username: userdata.data().Username, Email: userdata.data().email, About: userdata.data().About ? userdata.data().About : null,  ProfilePic: null});
          }
          profilepic.forEach((picData)=>{
            res.json({userId:user.uid, firstName: userdata.data().FirstName, lastName: userdata.data().LastName, username: userdata.data().Username, Email: userdata.data().email, About: userdata.data().About ? userdata.data().About : null,  ProfilePic: picData.data().image_url});
          })
        })
      })
    } else {
      res.send("Wrong user");
    }
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
};
exports.getUserID = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);
    if (user.uid === tmp.id) {
      res.json({userId:user.uid, firstName: user.FirstName, lastName: user.LastName, username: user.Username});
    } else {
      res.send("Wrong user");
    }
  }).catch(()=>{
	res.send('Wrong Id token')
})
  
};

exports.getFullName = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
admin
.auth()
.verifyIdToken(idToken)
.then((decodedToken) => {
  var tmp = db.collection("users").doc(user.uid);
  if (user.uid === tmp.id) {
    tmp.get().then((data) => {
      var first = data.data().FirstName;
      var last = data.data().LastName;
      var result = first.concat(" " + last);
      res.send(result);
    });
  } else {
    res.send("Wrong user");
  }

}).catch(()=>{
	res.send('Wrong Id token')
})
  
  
};

exports.getUsername = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);
    if (user.uid === tmp.id) {
      tmp.get().then((data) => {
        var username = data.data().Username;
        res.json({Username:username});
      });
    } else {
      res.send("Wrong user");
    }
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
};

exports.getAbout = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);
    if (user.uid === tmp.id) {
      tmp.get().then((data) => {
        var about = data.data().About;
        res.json({About:about});
      });
    } else {
      res.send("Wrong user");
    }
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
  
};
exports.getisPrivate = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);
    if (user.uid === tmp.id) {
      tmp.get().then((data) => {
        var isPrivate = data.data().isPrivate;
        res.json({isPrivate:isPrivate});
      });
    } else {
      res.send("Wrong user");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
};

exports.getPostCount = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid).collection("TotalPosts").doc(req.params.totalPosts);
    if (user.uid === tmp.id) {
      tmp.get().then((data) => {
        var totalPosts = data.data().Total;
        res.json({Total:totalPosts});
      });
    } else {
      res.send("Wrong user");
    }
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
};
exports.getFollowingCount = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid).collection("TotalFollowing").doc(req.params.totalFollowing);
    if (user.uid === tmp.id) {
      tmp.get().then((data) => {
        var totalFollowing = data.data().Total;
        res.json({TotalFollowing:totalFollowing});
      });
    } else {
      res.send("Wrong user");
    }
  }).catch(()=>{
    res.send('Wrong Id token')
  })
};

exports.getFollowersCount = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid).collection("TotalFollowers").doc(req.params.totalFollowers);
    if (user.uid === tmp.id) {
      tmp.get().then((data) => {
        var totalFollowers = data.data().Total;
        res.json({TotalFollowers:totalFollowers});
      });
    } else {
      res.send("Wrong user");
    }
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
};

exports.getPostData = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid)
    var tmp1 = db.collection("users").doc(user.uid).collection("posts").doc(req.params.postID);
    var totallikes = db.collection("users").doc(user.uid).collection("posts").doc(req.params.postID).collection("TotalLikes");
    var totalcomments = db.collection("users").doc(user.uid).collection("posts").doc(req.params.postID).collection("TotalComments");
    var totalshares = db.collection("users").doc(user.uid).collection("posts").doc(req.params.postID).collection("TotalShares");
    var seen = db.collection("users").doc(user.uid).collection("posts").doc(req.params.postID).collection("Seen");
    var totalSeen = db.collection("users").doc(user.uid).collection("posts").doc(req.params.postID).collection("TotalSeen");
    var profilePic = db.collection("users").doc(user.uid).collection("ProfilePic");

    if (user.uid === tmp.id) {
      comm = []
      likes = []
      seenIds = []
      tmp1.get().then((data) => {
        var postdata = data.data();
        console.log(postdata);
        if(!postdata){
          res.send("Post not found")
        }

        tmp.get().then((userdata)=>{
          
            
              profilePic.get().then((pic)=>{
              
                
                pic.forEach((userProfile)=>{
                  totallikes.get().then((likes)=>{
                    if(likes.docs.length <= 0){
                    
                      
                      totalcomments.get().then((document)=>{
                        if(document.docs.length <= 0){
                          tmp1.collection("Comments").get().then((whoCommented)=>{
                            if(whoCommented.docs.length <=0){
                              
                              comm.push([])
                            }
                            else{
                              whoCommented.forEach((payload)=>{
                                comm.push({CommentText:payload.data().CommentText, Name:payload.data().Name, Pic:payload.data().Pic, Timestamp:payload.data().Timestamp})
                              })
                            }
                            console.log(comm);
                          }).then(()=>{
                            totalshares.get().then((shares)=>{
                              if(shares.docs.length <= 0){
                                seen.get().then((seenPayload)=>{
                                  if (seenPayload.docs.length <=0){
                                    res.json({PostData:postdata, postID:req.params.postID, whoPosted: {firstname: userdata.data().FirstName, lastname:userdata.data().LastName, profilepic:userProfile.data() ,userID:userdata.data().userId}, whoCommented:{CommentsData:comm}, seenBy:{SeenData:seenIds}, TotalLikes:0, TotalComments:0, TotalShares:0, TotalSeen: 0});

                                  } 
                                    seenPayload.forEach((seenIds)=>{
                                      seenIds.push({firstname:seenIds.data().FirstName, lastname:seenIds.data().LastName, profilepic:seenIds.data().ProfilePic, username:seenIds.data().Username})
                                    })
                                })
                                totalSeen.get().then((totalseen)=>{
                                  totalseen.forEach((totalSeenData)=>{
                                    res.json({PostData:postdata, postID:req.params.postID, whoPosted: {firstname: userdata.data().FirstName, lastname:userdata.data().LastName, profilepic:userProfile.data() ,userID:userdata.data().userId}, whoCommented:{CommentsData:comm}, seenBy:{SeenData:seenIds}, TotalLikes:0, TotalComments:0, TotalShares:0, TotalSeen: totalSeenData.data()});

                                  })
                                })

                              }
                              shares.forEach((sharestotal)=>{
                                res.json({PostData:postdata, postID:req.params.postID, whoPosted: {firstname: userdata.data().FirstName, lastname:userdata.data().LastName, profilepic:userProfile.data() ,userID:userdata.data().userId}, whoCommented:{CommentsData:comm}, TotalLikes:0, TotalComments:0, TotalShares:sharestotal.data()});
                              })
                            })
                          })
                        }
                        document.forEach((commentsTotal)=>{
                          tmp1.collection("Comments").get().then((whoCommented)=>{
                            if(whoCommented.docs.length <=0){
                              
                              comm.push(0)
                            }
                            else{
                              whoCommented.forEach((payload)=>{
                                comm.push({CommentText:payload.data().CommentText, Name:payload.data().Name, Pic:payload.data().Pic, Timestamp:payload.data().Timestamp})
                              })
                            }
                            console.log(comm);
                          }).then(()=>{
                            totalshares.get().then((shares)=>{
                              if(shares.docs.length <= 0){
                                
                                res.json({PostData:postdata, postID:req.params.postID, whoPosted: {firstname: userdata.data().FirstName, lastname:userdata.data().LastName, profilepic:userProfile.data() ,userID:userdata.data().userId}, whoCommented:{CommentsData:comm}, TotalLikes:0, TotalComments:commentsTotal.data(), TotalShares:0});

                              }
                              shares.forEach((sharestotal)=>{
                                res.json({PostData:postdata, postID:req.params.postID, whoPosted: {firstname: userdata.data().FirstName, lastname:userdata.data().LastName, profilepic:userProfile.data() ,userID:userdata.data().userId}, whoCommented:{CommentsData:comm}, TotalLikes:0, TotalComments:commentsTotal.data(), TotalShares:sharestotal.data()});
                              })
                            })
                          })
                        })
                      })
                    }
                    likes.forEach((likestotal)=>{
                      totalcomments.get().then((document)=>{
                        if(document.docs.length <= 0 ){
                          
                          tmp1.collection("Comments").get().then((whoCommented)=>{
                            whoCommented.forEach((payload)=>{
                              comm.push({CommentText:payload.data().CommentText, Name:payload.data().Name, Pic:payload.data().Pic, Timestamp:payload.data().Timestamp})
                            })
                            console.log(comm);
                          }).then(()=>{
                            totalshares.get().then((shares)=>{
                              if(shares.docs.length <= 0){
                                
                                res.json({PostData:postdata, postID:req.params.postID, whoPosted: {firstname: userdata.data().FirstName, lastname:userdata.data().LastName, profilepic:userProfile.data() ,userID:userdata.data().userId}, whoCommented:{CommentsData:comm}, TotalLikes:likestotal.data(), TotalComments:0, TotalShares:0});

                              }
                              shares.forEach((sharestotal)=>{
                                res.json({PostData:postdata, postID:req.params.postID, whoPosted: {firstname: userdata.data().FirstName, lastname:userdata.data().LastName, profilepic:userProfile.data() ,userID:userdata.data().userId}, whoCommented:{CommentsData:comm}, TotalLikes:likestotal.data(), TotalComments:0, TotalShares:sharestotal.data()});
                              })
                            })
                          })
                        }
                        document.forEach((commentsTotal)=>{
                          tmp1.collection("Comments").get().then((whoCommented)=>{
                            whoCommented.forEach((payload)=>{
                              comm.push({CommentText:payload.data().CommentText, Name:payload.data().Name, Pic:payload.data().Pic, Timestamp:payload.data().Timestamp})
                            })
                            console.log(comm);
                          }).then(()=>{
                            totalshares.get().then((shares)=>{
                              if(shares.docs.length <= 0){
                                
                                res.json({PostData:postdata, postID:req.params.postID, whoPosted: {firstname: userdata.data().FirstName, lastname:userdata.data().LastName, profilepic:userProfile.data() ,userID:userdata.data().userId}, whoCommented:{CommentsData:comm}, TotalLikes:likestotal.data(), TotalComments:commentsTotal.data(), TotalShares:0});

                              }
                              shares.forEach((sharestotal)=>{
                                res.json({PostData:postdata, postID:req.params.postID, whoPosted: {firstname: userdata.data().FirstName, lastname:userdata.data().LastName, profilepic:userProfile.data() ,userID:userdata.data().userId}, whoCommented:{CommentsData:comm}, TotalLikes:likestotal.data(), TotalComments:commentsTotal.data(), TotalShares:sharestotal.data()});
                              })
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
        })
        
      }).catch((err)=>{
        res.send("Post not found")
      });
    } else {
      res.send("Wrong user");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
};

exports.getEmail = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);
    if (user.uid === tmp.id) {
      tmp.get().then((data) => {
        var email = data.data().email;
        res.send(email);
      });
    } else {
      res.send("Wrong user");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
};

exports.voiceChat = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);
    if (user.uid === tmp.id) {
      console.log(user.uid);
      console.log(tmp.id);
      const upload = multer({ storage }).single("voice");

      upload(req, res, function (err) {
        if (err) {
          return res.send(err);
        }

        let image_url = null;
        console.log("voice uploaded to server");

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
          { public_id: `Voice/${uniqueFilename}`, tags: `Voice` }, // directory and tags are optional
          function (err, image) {
            if (err) return res.send(err);
            console.log("Voice file uploaded to Cloudinary");

            var fs = require("fs");
            fs.unlinkSync(path);

            voice = image.secure_url;

            tmp1
              .collection("messages")
              .doc(req.params.pID)
              .update({ Voice: voice })
              .then(function () {
                res.send("Voice added");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
            //res.json(image);
          }
        );

        // SEND FILE TO CLOUDINARY
      });
    } else {
      res.send("Can't alter someone else chat");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
};

exports.unfollow = async (req, res) => {
  var user = firebase.auth().currentUser;
  if(user){
    var tmp = db.collection("users").doc(user.uid).collection("Following").doc(req.params.id)
    tmp.get().then((data)=>{
      if(!data){
        res.send("User not found")
      }
      tmp.delete().then(()=>{
        res.send("User unfollowed")
      })
    })
  }
  else{
    res.send("Not authorized")
  }
}

exports.getProfilePic = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
admin
.auth()
.verifyIdToken(idToken)
.then((decodedToken) => {
  var tmp = db.collection("users").doc(user.uid).collection("ProfilePic").doc(req.params.profilePicId);
  tmp.get().then((data) => {
    console.log(data);
    var pic = data.data().image_url;
    console.log(pic);
    res.send(pic);
  });
}).catch(()=>{
	res.send('Wrong Id token')
})
}

exports.postDelete = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid).collection("posts").doc(req.params.postId);
    tmp.get().then((data) => {
      if(!data){
        res.send("Post not found")
      }
      tmp.delete().then(()=>{
        res.send("Post deleted")
      })
    });
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
}


exports.getAllPosts = async (req, res) => {
      var user = firebase.auth().currentUser;
      var posts = []
      var followingId = []
      if(user){
      var tmp = db.collection("users").doc(user.uid)
        tmp.collection("Following").get().then((doc)=>{
          console.log("object");
          doc.forEach((docID)=>{
            followingId.push(docID)
            db.collection("users").doc(docID.id).collection("posts").get().then((postData)=>{
              postData.forEach((postPayload)=>{
                console.log("lmao");
                  db.collection("users").doc(docID.id).collection("posts").doc(postPayload.id).get().then((post)=>{  
                  console.log("kappa",post.data());
                  posts.push(post.data()) 
                })
              })
            })
              
          })
          res.send({Posts: posts})
        })
      }else{
        res.send("Not authorized")
      }

}

// exports.liveEmojiReact = async (req, res) => {  
//   const idToken = req.headers.authorization
//   var user = firebase.auth().currentUser;
//   if(!user){
//     console.log("Not authorized");
//     res.send("Not authorized")
//   }
//   admin
//   .auth()
//   .verifyIdToken(idToken)
//   .then((decodedToken) => {
//     var tmp = db.collection("users").doc(req.params.id);
//     var tmp1 = db.collection("users").doc(user.uid);

//     if (
//       req.body.emoji === "\u200D\u2764\uFE0F\u200D" ||
//       req.body.emoji === "\uD83D\uDE02" ||
//       req.body.emoji === "\uD83D\uDE22" ||
//       req.body.emoji === "\uD83D\uDE21" ||
//       req.body.emoji === "\uD83D\uDC4D"
//     ) {
//       db.collection("users")
//         .doc(user.uid)
//         .get()
//         .then((querySnapshot) => {
//           tmp
//           .collection("Live")
//           .doc(req.params.liveID)
//           .collection("livereacts")
//           .add({
//             EmojiReact: {
//               Username: querySnapshot.data().Username,
//               react:req.body.emoji
//             },
//           })
//         })
//       .then(function () {
//         res.send("Emoji reacted");
//       });
//     }
//       else res.send("Invalid Emoji");
  
//   }).catch(()=>{
//     res.send('Wrong Id token')
//   })
  
// }

exports.musicTag = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);
    if (user.uid === tmp.id) {
      console.log(user.uid);
      console.log(tmp.id);
      const upload = multer({ storage }).single("music");

      upload(req, res, function (err) {
        if (err) {
          return res.send(err);
        }

        let image_url = null;
        console.log("file uploaded to server");

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
          { public_id: `MusicTag/${uniqueFilename}`, tags: `MusicTag` }, // directory and tags are optional
          function (err, image) {
            if (err) return res.send(err);
            console.log("file uploaded to Cloudinary");

            var fs = require("fs");
            fs.unlinkSync(path);

            musicTag = image.secure_url;

            tmp1
              .collection("posts")
              .doc(req.params.pID)
              .update({ Music: musicTag })
              .then(function () {
                res.send("Music added");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
            //res.json(image);
          }
        );

        // SEND FILE TO CLOUDINARY
      });
    } else {
      res.send("Can't alter someone else post");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
};
exports.friendsTag = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then(async (decodedToken) => {
    var comp = db.collection("users").doc(req.params.id);
    var tmp = db.collection("users").doc(req.params.tagID);
    var tmp1 = db.collection("users").doc(user.uid);
    if (user.uid === comp.id) {
      const value = await tmp1
        .collection("Following")
        .doc(req.params.tagID)
        .get();
      if (!value.exists) {
        console.log("Follow the user first");
        res.send("Follow the user first");
      } else {
        tmp.get().then((snapshot) => {
          var str1 = snapshot.data().Username;

          tmp1
            .collection("posts")
            .doc(req.params.pID)
            .update({
              Tag: {
                Name: str1,
                userID: req.params.tagID,
              },
            })
            .then(function () {
              tmp1.get().then((value) => {
                var str1 = value.data().FirstName;
                var str2 = value.data().LastName;
                var result = str1.concat(" ", str2);
                var vi = "just tagged you in a post.";
                var Notification = result.concat(" ", vi);
                tmp
                  .collection("NotificationsTab")
                  .add({ Notification, Status: { Read: false }, Timestamp: admin.firestore.FieldValue.serverTimestamp() });
              });

              res.send("Friend tagged");
            });
        });
      }
    } else {
      res.send("Can't alter someone else post");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
};





exports.posts = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  const fontName = ['Nimla', 'Poppins', 'Monster']

  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);

    if (tmp.id === user.uid) {
      console.log(tmp.id);

      console.log(user.uid);
      const upload = multer({ storage }).single("display");

      upload(req, res, function (err) {
        if (err) {
          return res.send(err);
        }
        
        let image_url = null;
        console.log("file uploaded to server");

        if (req.file && req.body.PostText) {
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
            { public_id: `PostsPics/${uniqueFilename}`, tags: `PostsPics` }, // directory and tags are optional
            function (err, image) {
              if (err) return res.send(err);
              console.log("file uploaded to Cloudinary");

              var fs = require("fs");
              fs.unlinkSync(path);

              image_url = image.secure_url;
              if(req.body.fontname == 'Nimla'|| req.body.fontname == 'Poppins' || req.body.fontname == 'Monster'){
                if(req.body.bold && !req.body.underline && !req.body.italic){
                  console.log("object");
                  return tmp
                  .collection("posts")
                  .add(
                    {
                      image_url: image_url,
                      PostText: req.body.PostText,
                      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      fontName: req.body.fontname,
                      Bold: req.body.bold,
                      Underline: null,
                      Italic: null,
                      scheduled:false
                    },
                    { merge: true }
                  )
                  .then(function () {
                    db.collection("users")
                      .doc(user.uid)
                      .collection("Followers")
                      .get()
                      .then((value) => {
                        value.forEach((doc) => {
                          db.collection("users")
                            .doc(doc.id)
                            .collection("NewsFeed")
                            .add({
                              image_url: image_url,
                              PostText: req.body.PostText,
                              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                              fontName: req.body.fontname,
                              Bold: req.body.bold,
                              Underline: null,
                              Italic: null, 
                              scheduled:false
                              
                            });
                        });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size; // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: 0,
                          });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size;
                        console.log(size); // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: size,
                          });
                      });
                  })
                  .then(function () {
                    res.status(200).send("Document successfully updated!");
                  })
                  .catch(function (error) {
                    // The document probably doesn't exist.
                    //res.status(400).send("error", error);
                    //res.status(404).send("Error updating document: ", error);
                  });
                }
                else if(!req.body.bold && req.body.underline && !req.body.italic){
                  return tmp
                  .collection("posts")
                  .add(
                    {
                      image_url: image_url,
                      PostText: req.body.PostText,
                      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      fontName: req.body.fontname,
                      Bold: null,
                      Underline: req.body.underline,
                      Italic: null,
                      scheduled:false
                    },
                    { merge: true }
                  )
                  .then(function () {
                    db.collection("users")
                      .doc(user.uid)
                      .collection("Followers")
                      .get()
                      .then((value) => {
                        value.forEach((doc) => {
                          db.collection("users")
                            .doc(doc.id)
                            .collection("NewsFeed")
                            .add({
                              image_url: image_url,
                              PostText: req.body.PostText,
                              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                              fontName: req.body.fontname,
                              Bold: null,
                              Underline: req.body.underline,
                              Italic: null,
                              scheduled:false
                            });
                        });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size; // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: 0,
                          });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size;
                        console.log(size); // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: size,
                          });
                      });
                  })
                  .then(function () {
                    res.status(200).send("Document successfully updated!");
                  })
                  .catch(function (error) {
                    // The document probably doesn't exist.
                    //res.status(400).send("error", error);
                    //res.status(404).send("Error updating document: ", error);
                  });
                }
                else if(!req.body.bold && !req.body.underline && req.body.italic){
                  return tmp
                  .collection("posts")
                  .add(
                    {
                      image_url: image_url,
                      PostText: req.body.PostText,
                      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      fontName: req.body.fontname,
                      Bold: null,
                      Underline: null,
                      Italic: req.body.italic, 
                      scheduled:false

                    },
                    { merge: true }
                  )
                  .then(function () {
                    db.collection("users")
                      .doc(user.uid)
                      .collection("Followers")
                      .get()
                      .then((value) => {
                        value.forEach((doc) => {
                          db.collection("users")
                            .doc(doc.id)
                            .collection("NewsFeed")
                            .add({
                              image_url: image_url,
                              PostText: req.body.PostText,
                              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                              fontName: req.body.fontname,
                              Bold: null,
                              Underline: null,
                              Italic: req.body.italic,
                              scheduled:false
                              
                            });
                        });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size; // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: 0,
                          });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size;
                        console.log(size); // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: size,
                          });
                      });
                  })
                  .then(function () {
                    res.status(200).send("Document successfully updated!");
                  })
                  .catch(function (error) {
                    // The document probably doesn't exist.
                    //res.status(400).send("error", error);
                    //res.status(404).send("Error updating document: ", error);
                  });
                }
                else if(req.body.bold && req.body.underline && !req.body.italic){
                  return tmp
                  .collection("posts")
                  .add(
                    {
                      image_url: image_url,
                      PostText: req.body.PostText,
                      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      fontName: req.body.fontname,
                      Bold: req.body.bold,
                      Underline: req.body.underline,
                      Italic: null,
                      scheduled:false

                    },
                    { merge: true }
                  )
                  .then(function () {
                    db.collection("users")
                      .doc(user.uid)
                      .collection("Followers")
                      .get()
                      .then((value) => {
                        value.forEach((doc) => {
                          db.collection("users")
                            .doc(doc.id)
                            .collection("NewsFeed")
                            .add({
                              image_url: image_url,
                              PostText: req.body.PostText,
                              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                              fontName: req.body.fontname,
                              Bold: req.body.bold,
                              Underline: req.body.underline,
                              Italic: null,
                              scheduled:false
                              
                            });
                        });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size; // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: 0,
                          });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size;
                        console.log(size); // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: size,
                          });
                      });
                  })
                  .then(function () {
                    res.status(200).send("Document successfully updated!");
                  })
                  .catch(function (error) {
                    // The document probably doesn't exist.
                    //res.status(400).send("error", error);
                    //res.status(404).send("Error updating document: ", error);
                  });
                }
                else if(req.body.bold && !req.body.underline && req.body.italic){
                  return tmp
                  .collection("posts")
                  .add(
                    {
                      image_url: image_url,
                      PostText: req.body.PostText,
                      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      fontName: req.body.fontname,
                      Bold: req.body.bold,
                      Underline: null,
                      Italic: req.body.italic,
                      scheduled:false

                    },
                    { merge: true }
                  )
                  .then(function () {
                    db.collection("users")
                      .doc(user.uid)
                      .collection("Followers")
                      .get()
                      .then((value) => {
                        value.forEach((doc) => {
                          db.collection("users")
                            .doc(doc.id)
                            .collection("NewsFeed")
                            .add({
                              image_url: image_url,
                              PostText: req.body.PostText,
                              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                              fontName: req.body.fontname,
                              Bold: req.body.bold,
                              Underline: null,
                              Italic: req.body.italic,
                              scheduled:false
                              
                            });
                        });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size; // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: 0,
                          });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size;
                        console.log(size); // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: size,
                          });
                      });
                  })
                  .then(function () {
                    res.status(200).send("Document successfully updated!");
                  })
                  .catch(function (error) {
                    // The document probably doesn't exist.
                    //res.status(400).send("error", error);
                    //res.status(404).send("Error updating document: ", error);
                  });
                }
                else if(!req.body.bold && req.body.underline && req.body.italic){
                  return tmp
                  .collection("posts")
                  .add(
                    {
                      image_url: image_url,
                      PostText: req.body.PostText,
                      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      fontName: req.body.fontname,
                      Bold: null,
                      Underline: req.body.underline,
                      Italic: req.body.italic,
                      scheduled:false

                    },
                    { merge: true }
                  )
                  .then(function () {
                    db.collection("users")
                      .doc(user.uid)
                      .collection("Followers")
                      .get()
                      .then((value) => {
                        value.forEach((doc) => {
                          db.collection("users")
                            .doc(doc.id)
                            .collection("NewsFeed")
                            .add({
                              image_url: image_url,
                              PostText: req.body.PostText,
                              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                              fontName: req.body.fontname,
                              Bold: null,
                              Underline: req.body.underline,
                              Italic: req.body.italic,
                              scheduled:false
                              
                            });
                        });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size; // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: 0,
                          });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size;
                        console.log(size); // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: size,
                          });
                      });
                  })
                  .then(function () {
                    res.status(200).send("Document successfully updated!");
                  })
                  .catch(function (error) {
                    // The document probably doesn't exist.
                    //res.status(400).send("error", error);
                    //res.status(404).send("Error updating document: ", error);
                  });
                }
                else if(req.body.bold && req.body.underline && req.body.italic){
                  return tmp
                  .collection("posts")
                  .add(
                    {
                      image_url: image_url,
                      PostText: req.body.PostText,
                      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      fontName: req.body.fontname,
                      Bold: req.body.bold,
                      Underline: req.body.underline,
                      Italic: req.body.italic,
                      scheduled:false

                    },
                    { merge: true }
                  )
                  .then(function () {
                    db.collection("users")
                      .doc(user.uid)
                      .collection("Followers")
                      .get()
                      .then((value) => {
                        value.forEach((doc) => {
                          db.collection("users")
                            .doc(doc.id)
                            .collection("NewsFeed")
                            .add({
                              image_url: image_url,
                              PostText: req.body.PostText,
                              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                              fontName: req.body.fontname,
                              Bold: req.body.bold,
                              Underline: req.body.underline,
                              Italic: req.body.italic,
                              scheduled:false
                              
                            });
                        });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size; // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: 0,
                          });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size;
                        console.log(size); // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: size,
                          });
                      });
                  })
                  .then(function () {
                    res.status(200).send("Document successfully updated!");
                  })
                  .catch(function (error) {
                    // The document probably doesn't exist.
                    //res.status(400).send("error", error);
                    //res.status(404).send("Error updating document: ", error);
                  });
                }

                return tmp
                  .collection("posts")
                  .add(
                    {
                      image_url: image_url,
                      PostText: req.body.PostText,
                      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      fontName: req.body.fontname,
                      scheduled:false
                    },
                    { merge: true }
                  )
                  .then(function () {
                    db.collection("users")
                      .doc(user.uid)
                      .collection("Followers")
                      .get()
                      .then((value) => {
                        value.forEach((doc) => {
                          db.collection("users")
                            .doc(doc.id)
                            .collection("NewsFeed")
                            .add({
                              image_url: image_url,
                              PostText: req.body.PostText,
                              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                              fontName: req.body.fontname,
                              scheduled:false
                                                          
                            });
                        });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size; // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: 0,
                          });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size;
                        console.log(size); // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: size,
                          });
                      });
                  })
                  .then(function () {
                    res.status(200).send("Document successfully updated!");
                  })
                  .catch(function (error) {
                    // The document probably doesn't exist.
                    //res.status(400).send("error", error);
                    //res.status(404).send("Error updating document: ", error);
                  });
              }else{
                res.send("Wrong fontname")
              }
              
              //res.json(image);
            }
          );
        } else if (
          (req.body.PostText && req.file === null) ||
          (req.body.PostText && !req.file)
        ) {
          console.log("no file", req.file);
          if(req.body.fontname == 'Nimla'|| req.body.fontname == 'Poppins' || req.body.fontname == 'Monster'){
            if(req.body.bold && !req.body.underline && !req.body.italic){

              return tmp
              .collection("posts")
              .add(
                {
                  image_url: image_url,
                  PostText: req.body.PostText,
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  fontName: req.body.fontname,
                  Bold: req.body.bold,
                  Underline: null,
                  Italic: null,
                  scheduled:false
                },
                { merge: true }
              )
              .then(function () {
                db.collection("users")
                  .doc(user.uid)
                  .collection("Followers")
                  .get()
                  .then((value) => {
                    value.forEach((doc) => {
                      db.collection("users")
                        .doc(doc.id)
                        .collection("NewsFeed")
                        .add({
                          image_url: image_url,
                          PostText: req.body.PostText,
                          Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          fontName: req.body.fontname,
                          Bold: req.body.bold,
                          Underline: null,
                          Italic: null,
                          scheduled:false
                        });
                    });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size; // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: 0,
                      });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size;
                    console.log(size); // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: size,
                      });
                  });
              })
              .then(function () {
                res.status(200).send("Document successfully updated!");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                //res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
            }
            else if(!req.body.bold && req.body.underline && !req.body.italic){
              return tmp
              .collection("posts")
              .add(
                {
                  image_url: image_url,
                  PostText: req.body.PostText,
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  fontName: req.body.fontname,
                  Bold: null,
                  Underline: req.body.underline,
                  Italic: null,
                  scheduled:false
                },
                { merge: true }
              )
              .then(function () {
                db.collection("users")
                  .doc(user.uid)
                  .collection("Followers")
                  .get()
                  .then((value) => {
                    value.forEach((doc) => {
                      db.collection("users")
                        .doc(doc.id)
                        .collection("NewsFeed")
                        .add({
                          image_url: image_url,
                          PostText: req.body.PostText,
                          Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          fontName: req.body.fontname,
                          Bold: null,
                          Underline: req.body.underline,
                          Italic: null,
                          scheduled:false
                          
                        });
                    });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size; // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: 0,
                      });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size;
                    console.log(size); // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: size,
                      });
                  });
              })
              .then(function () {
                res.status(200).send("Document successfully updated!");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                //res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
            }
            else if(!req.body.bold && !req.body.underline && req.body.italic){
              return tmp
              .collection("posts")
              .add(
                {
                  image_url: image_url,
                  PostText: req.body.PostText,
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  fontName: req.body.fontname,
                  Bold: null,
                  Underline: null,
                  Italic: req.body.italic,
                  scheduled:false
                },
                { merge: true }
              )
              .then(function () {
                db.collection("users")
                  .doc(user.uid)
                  .collection("Followers")
                  .get()
                  .then((value) => {
                    value.forEach((doc) => {
                      db.collection("users")
                        .doc(doc.id)
                        .collection("NewsFeed")
                        .add({
                          image_url: image_url,
                          PostText: req.body.PostText,
                          Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          fontName: req.body.fontname,
                          Bold: null,
                          Underline: null,
                          Italic: req.body.italic,
                          scheduled:false
                          
                        });
                    });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size; // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: 0,
                      });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size;
                    console.log(size); // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: size,
                      });
                  });
              })
              .then(function () {
                res.status(200).send("Document successfully updated!");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                //res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
            }
            else if(req.body.bold && req.body.underline && !req.body.italic){
              return tmp
              .collection("posts")
              .add(
                {
                  image_url: image_url,
                  PostText: req.body.PostText,
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  fontName: req.body.fontname,
                  Bold: req.body.bold,
                  Underline: req.body.underline,
                  Italic: null,
                  scheduled:false

                },
                { merge: true }
              )
              .then(function () {
                db.collection("users")
                  .doc(user.uid)
                  .collection("Followers")
                  .get()
                  .then((value) => {
                    value.forEach((doc) => {
                      db.collection("users")
                        .doc(doc.id)
                        .collection("NewsFeed")
                        .add({
                          image_url: image_url,
                          PostText: req.body.PostText,
                          Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          fontName: req.body.fontname,
                          Bold: req.body.bold,
                          Underline: req.body.underline,
                          Italic: null,
                          scheduled:false
                          
                        });
                    });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size; // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: 0,
                      });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size;
                    console.log(size); // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: size,
                      });
                  });
              })
              .then(function () {
                res.status(200).send("Document successfully updated!");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                //res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
            }
            else if(req.body.bold && !req.body.underline && req.body.italic){
              return tmp
              .collection("posts")
              .add(
                {
                  image_url: image_url,
                  PostText: req.body.PostText,
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  fontName: req.body.fontname,
                  Bold: req.body.bold,
                  Underline: null,
                  Italic: req.body.italic,
                  scheduled:false

                },
                { merge: true }
              )
              .then(function () {
                db.collection("users")
                  .doc(user.uid)
                  .collection("Followers")
                  .get()
                  .then((value) => {
                    value.forEach((doc) => {
                      db.collection("users")
                        .doc(doc.id)
                        .collection("NewsFeed")
                        .add({
                          image_url: image_url,
                          PostText: req.body.PostText,
                          Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          fontName: req.body.fontname,
                          Bold: req.body.bold,
                          Underline: null,
                          Italic: req.body.italic,
                          scheduled:false
                          
                        });
                    });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size; // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: 0,
                      });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size;
                    console.log(size); // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: size,
                      });
                  });
              })
              .then(function () {
                res.status(200).send("Document successfully updated!");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                //res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
            }
            else if(!req.body.bold && req.body.underline && req.body.italic){
              return tmp
              .collection("posts")
              .add(
                {
                  image_url: image_url,
                  PostText: req.body.PostText,
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  fontName: req.body.fontname,
                  Bold: null,
                  Underline: req.body.underline,
                  Italic: req.body.italic,
                  scheduled:false

                },
                { merge: true }
              )
              .then(function () {
                db.collection("users")
                  .doc(user.uid)
                  .collection("Followers")
                  .get()
                  .then((value) => {
                    value.forEach((doc) => {
                      db.collection("users")
                        .doc(doc.id)
                        .collection("NewsFeed")
                        .add({
                          image_url: image_url,
                          PostText: req.body.PostText,
                          Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          fontName: req.body.fontname,
                          Bold: null,
                          Underline: req.body.underline,
                          Italic: req.body.italic,
                          scheduled:false
                          
                        });
                    });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size; // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: 0,
                      });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size;
                    console.log(size); // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: size,
                      });
                  });
              })
              .then(function () {
                res.status(200).send("Document successfully updated!");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                //res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
            }
            else if(req.body.bold && req.body.underline && req.body.italic){
              return tmp
              .collection("posts")
              .add(
                {
                  image_url: image_url,
                  PostText: req.body.PostText,
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  fontName: req.body.fontname,
                  Bold: req.body.bold,
                  Underline: req.body.underline,
                  Italic: req.body.italic,
                  scheduled:false

                },
                { merge: true }
              )
              .then(function () {
                db.collection("users")
                  .doc(user.uid)
                  .collection("Followers")
                  .get()
                  .then((value) => {
                    value.forEach((doc) => {
                      db.collection("users")
                        .doc(doc.id)
                        .collection("NewsFeed")
                        .add({
                          image_url: image_url,
                          PostText: req.body.PostText,
                          Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          fontName: req.body.fontname,
                          Bold: req.body.bold,
                          Underline: req.body.underline,
                          Italic: req.body.italic,
                          scheduled:false
                          
                        });
                    });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size; // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: 0,
                      });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size;
                    console.log(size); // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: size,
                      });
                  });
              })
              .then(function () {
                res.status(200).send("Document successfully updated!");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                //res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
            }
            return tmp
                .collection("posts")
                .add(
                  {
                    image_url: null,
                    PostText: req.body.PostText,
                    Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    fontName: req.body.fontname,
                    scheduled:false
                    
                    // Total: 1,
                    // Total: admin.firestore.FieldValue.increment(1),
                  },
                  { merge: true }
                )
                .then(function () {
                  db.collection("users")
                    .doc(user.uid)
                    .collection("Followers")
                    .get()
                    .then((value) => {
                      value.forEach((doc) => {
                        db.collection("users")
                          .doc(doc.id)
                          .collection("NewsFeed")
                          .add({
                            image_url: null,
                            PostText: req.body.PostText,
                            Timestamp: admin.firestore.FieldValue.serverTimestamp()
                          });
                      });
                    });
                  db.collection("users")
                    .doc(user.uid)
                    .collection("posts")
                    .get()
                    .then((snap) => {
                      size = snap.size; // will return the collection size
                      db.collection("users")
                        .doc(user.uid)
                        .collection("TotalPosts")
                        .doc(user.uid)
                        .set({
                          Total: 0,
                        });
                    });
    
                  db.collection("users")
                    .doc(user.uid)
                    .collection("posts")
                    .get()
                    .then((snap) => {
                      size = snap.size; // will return the collection size
                      db.collection("users")
                        .doc(user.uid)
                        .collection("TotalPosts")
                        .doc(user.uid)
                        .set({
                          Total: size,
                        });
                    });
                })
                .then(function () {
                  res.status(200).send("Document successfully updated!");
                })
                .catch(function (error) {
                  // The document probably doesn't exist.
                  res.status(400).send("error", error);
                  //res.status(404).send("Error updating document: ", error);
                });
          }else{
            res.send("Wrong fontname")
          }
        }

        if (
          (req.file && !req.body.PostText) ||
          (req.file && req.body.PostText === null)
        ) {
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
            { public_id: `PostsPics/${uniqueFilename}`, tags: `PostsPics` }, // directory and tags are optional
            function (err, image) {
              if (err) return res.send(err);
              console.log("file uploaded to Cloudinary");

              var fs = require("fs");
              fs.unlinkSync(path);

              image_url = image.secure_url;
              console.log(image_url);
                return tmp
                    .collection("posts")
                    .add(
                      {
                        image_url: image_url,
                        PostText: null,
                        Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        fontName: null,
                        Bold: null,
                        Underline: null,
                        Italic: null,
                        scheduled:false
                      },
                      { merge: true }
                    )
                    .then(function () {
                      db.collection("users")
                        .doc(user.uid)
                        .collection("Followers")
                        .get()
                        .then((value) => {
                          value.forEach((doc) => {
                            db.collection("users")
                              .doc(doc.id)
                              .collection("NewsFeed")
                              .add({
                                image_url: image_url,
                                PostText: null,
                                Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                fontName: null,
                                Bold: null,
                                Underline: null,
                                Italic: null,
                                scheduled:false
                              });
                          });
                        });
                      db.collection("users")
                        .doc(user.uid)
                        .collection("posts")
                        .get()
                        .then((snap) => {
                          size = snap.size; // will return the collection size
                          db.collection("users")
                            .doc(user.uid)
                            .collection("TotalPosts")
                            .doc(user.uid)
                            .set({
                              Total: 0,
                            });
                        });
    
                      db.collection("users")
                        .doc(user.uid)
                        .collection("posts")
                        .get()
                        .then((snap) => {
                          size = snap.size; // will return the collection size
                          db.collection("users")
                            .doc(user.uid)
                            .collection("TotalPosts")
                            .doc(user.uid)
                            .set({
                              Total: size,
                            });
                        });
                    })
                    .then(function () {
                      res.status(200).send("Document successfully updated!");
                    })
                    .catch(function (error) {
                      // The document probably doesn't exist.
                      res.status(400).send("error", error);
                      //res.status(404).send("Error updating document: ", error);
                    });
              
              //res.json(image);
            }
          );
        }

        // SEND FILE TO CLOUDINARY
      });
    } else {
      res.send("Not authorized");
    }
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
};
//get the message
exports.msgingget = async (req, res) => {
  var user = firebase.auth().currentUser;
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);
    if (tmp.id !== user.uid) {
      return tmp
        .collection("Messages")
        .doc(firebase.auth().currentUser.email)
        .collection("MyMessages")
        .orderBy("forSorting")
        .get()
        .then((value) => {
          // console.log(value.docs.data());
          value.docs.map((doc) => console.log(doc.data().MessageText));
        });
    }
  }
};

exports.favPosts = async (req, res) => {

  var user = firebase.auth().currentUser;
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);

    docID = [];
    if (tmp.id !== user.uid) {
      await tmp1
        .collection("Following")
        .doc(req.params.id)
        .get()
        .then((value) => {
          console.log(value.data().Following);
          const val = value.data().Following;

          if (val) {
            var counter = 0;
            tmp
              .collection("posts")
              .get()
              .then((querySnapshot) => {
                querySnapshot.forEach((doc) => {
                 
                  docID.push(doc.id);
                  // console.log(doc.id);

                  if (doc.id === req.params.postID) {
                    counter = counter + 1;
                   
                    tmp
                      .collection("posts")
                      .doc(req.params.postID)
                      .get()
                      .then((v) => {
                        console.log("its the data", v.data());
                        tmp1.collection("FavouritePosts").add({
                          PostID: req.params.postID,
                          FavPostUserId: req.params.id,
                        });
                      });
                    const just = async () => {
                      
                      await tmp1
                        .collection("FavouritePosts")
                        .get()
                        .then((value) => {});

                      
                    };
                    just();
                  }
                });
              })
              .then(() => {
                if (counter >= 1) {
                  res.send("Post Found");
                } else res.send("No post ID found");
              });
          } else {
            res.send("User not followed");
          }
        })
        .catch(function (error) {
          res.status(404).send("User not followed");
        });
    }
    else{
      res.send("Cant favourite your own post")
    }
  }
  else{
    res.send("Not authorized")

  }
};

exports.emojiReact = async (req, res) => {
  var user = firebase.auth().currentUser;
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);
    if (
      req.body.emoji === "\u200D\u2764\uFE0F\u200D" ||
      req.body.emoji === "\uD83D\uDE02" ||
      req.body.emoji === "\uD83D\uDE22" ||
      req.body.emoji === "\uD83D\uDE21" ||
      req.body.emoji === "\uD83D\uDC4D"
    ) {
      tmp
        .collection("Messages")
        .doc(user.email)
        .collection("MyMessages")
        .doc(req.params.msgID)
        .update({
          EmojiReact: req.body.emoji,
        })
        .then(function () {
          res.send("Emoji reacted");
        });

      db.collection("users")
        .doc(req.params.id)
        .get()
        .then((value) => {
          tmp1
            .collection("Messages")
            .doc(value.data().email)
            .collection("MyMessages")
            .doc(req.params.msgID)
            .update({
              EmojiReact: req.body.emoji,
            });
          res.send("Emoji reacted");
        });
    } else res.send("Invalid Emoji");
  }
};

exports.msgSeen = async (req, res) => {
  var user = firebase.auth().currentUser;
  var sec;
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);

    if (tmp.id !== user.uid) {
      const val = await tmp.get().then((value) => {
        sec = value.data().email;
        if (user.email === value.data().email) {
          res.status(404).send("Cant mark your message as seen");
        } else {
          console.log(req.params.msgID);
          tmp
            .collection("Messages")
            .get()
            .then((value) => {
              console.log("sec", sec);
              tmp1
                .collection("Messages")
                .doc(sec)
                .collection("MyMessages")
                .doc(req.params.msgID)
                .update({
                  Status: {
                    Delivered: true,
                    Seen: true,
                  },
                });
              tmp
                .collection("Messages")
                .doc(user.email)
                .collection("MyMessages")
                .doc(req.params.msgID2)
                .update({
                  Status: {
                    Delivered: true,
                    Seen: true,
                  },
                });

            })

            .then(function () {
              res.status(200).send("Message seen");
            })
            .catch(function (error) {
              res.status(404).send("Bad request");
             
            });
        }
      });
    } else res.status(200).send("Cant lol");
  }
};

exports.story = async (req, res) => {
  console.log(Date.now());
  var milli = Date.now();
  const d = new Date(milli);
  milli = milli + 86400000;
  milli = milli - 28800000;
  console.log(milli);
  const dat = new Date(milli);
  var user = firebase.auth().currentUser;
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);
    if (tmp.id === user.uid) {
      const upload = multer({ storage }).single("display");
      upload(req, res, function (err) {
        if (err) {
          return res.send(err);
        }
        let image_url = null;
        console.log("file uploaded to server");
        if (req.file && req.body.StoryText) {
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
            {
              public_id: `StoryPics/${uniqueFilename}`,
              tags: `StoryPics`,
            }, // directory and tags are optional
            function (err, image) {
              if (err) return res.send(err);
              console.log("file uploaded to Cloudinary");
              var fs = require("fs");
              fs.unlinkSync(path);
              StoryPic = image.secure_url;
              const doc_data = tmp.get();
              const email = doc_data.email;
              const email1 = doc_data;
              console.log("EMAIL", email);
              console.log("EMAIL1", email1.email);
              return tmp
                .collection("Story")
                .add({
                  StoryText: req.body.StoryText,
                  StoryPic: StoryPic,
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                })
                .then(function (doc) {
                  var l = dat.getUTCMonth() + 1;
                  cron.schedule(
                    dat.getUTCMinutes() +
                      " " +
                      dat.getUTCHours() +
                      " " +
                      dat.getUTCDate() +
                      " " +
                      l +
                      " " +
                      "*",
                    () => {
                      tmp.collection("Story").doc(doc.id).delete();
                    },
                    {
                      scheduled: true,
                      timezone: "America/Los_Angeles",
                    }
                  );
                  res.status(200).send("Document successfully updated!");
                  console.log("Document updated");
                })
                .catch(function (error) {
                  res.status(400).send("Error");
                  // The document probably doesn't exist.
                });
            }
          );
        } else if (
          (req.body.StoryText && req.file === null) ||
          (req.body.StoryText && !req.file)
        ) {
          // console.log(admin.firestore.FieldValue.serverTimestamp());
          tmp
            .collection("Story")
            .add({
              StoryText: req.body.StoryText,
              StoryPic: null,
              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
            })
            .then(function (doc) {
              var l = dat.getUTCMonth() + 1;
              cron.schedule(
                dat.getUTCMinutes() +
                  " " +
                  dat.getUTCHours() +
                  " " +
                  dat.getUTCDate() +
                  " " +
                  l +
                  " " +
                  "*",
                () => {
                  tmp.collection("Story").doc(doc.id).delete();
                },
                {
                  scheduled: true,
                  timezone: "America/Los_Angeles",
                }
              );
              res.status(200).send("Document successfully updated!");
            })

            .catch(function (error) {
              // The document probably doesn't exist.
            });
        } else if (
          (req.file && !req.body.StoryText) ||
          (req.file && req.body.StoryText === null)
        ) {
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
            {
              public_id: `StoryPics/${uniqueFilename}`,
              tags: `StoryPics`,
            }, // directory and tags are optional
            function (err, image) {
              if (err) return res.send(err);
              console.log("file uploaded to Cloudinary");
              var fs = require("fs");
              fs.unlinkSync(path);
              StoryPic = image.secure_url;
              tmp
                .collection("Story")
                .add({
                  StoryText: null,
                  StoryPic: StoryPic,
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                })
                .then(function (doc) {
                  var l = dat.getUTCMonth() + 1;
                  cron.schedule(
                    dat.getUTCMinutes() +
                      " " +
                      dat.getUTCHours() +
                      " " +
                      dat.getUTCDate() +
                      " " +
                      l +
                      " " +
                      "*",
                    () => {
                      tmp.collection("Story").doc(doc.id).delete();
                    },
                    {
                      scheduled: true,
                      timezone: "America/Los_Angeles",
                    }
                  );
                  res.status(200).send("Document successfully updated!");
                })
                .catch(function (error) {
                  // The document probably doesn't exist.
                });
            }
          );
        }
      });
    } else {
      res.send("Wrong user");
    }
  } else {
    res.send("Not authorized");
  }
};

//CREATING A MESSAGE

exports.messaging = async (req, res) => {
  var user = firebase.auth().currentUser;
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);
    if (tmp.id !== user.uid) {
      const upload = multer({ storage }).single("display");

      upload(req, res, function (err) {
        if (err) {
          return res.send(err);
        }

        let image_url = null;
        console.log("file uploaded to server");

        if (req.file && req.body.PostText) {
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
            {
              public_id: `MessagePics/${uniqueFilename}`,
              tags: `MessagePics`,
            }, // directory and tags are optional
            function (err, image) {
              if (err) return res.send(err);
              console.log("file uploaded to Cloudinary");

              var fs = require("fs");
              fs.unlinkSync(path);

              MessagePic = image.secure_url;
              const doc_data = tmp.get();
              const email = doc_data.email;
              const email1 = doc_data;
              console.log("EMAIL", email);
              console.log("EMAIL1", email1.email);

              return tmp
                .collection("Messages")
                .doc(firebase.auth().currentUser.email)
                .collection("MyMessages")
                .add({
                  MessageText: req.body.PostText,
                  MessagePic: MessagePic,
                  EmojiReact: null,
                  Status: {
                    Delivered: false,
                    Seen: false,
                  },
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                })
                .then(function () {
                  tmp
                    .collection("Messages")
                    .doc(firebase.auth().currentUser.email)
                    .collection("MyMessages")
                    .orderBy("Timestamp");
                  res.status(200).send("Document successfully updated!");
                })
                .then(function () {
                  db.collection("users")
                    .doc(req.params.id)
                    .get()
                    .then((value) => {
                      tmp1
                        .collection("Messages")
                        .doc(value.data().email)
                        .collection("MyMessages")
                        .add({
                          MessageText: req.body.PostText,
                          MessagePic: MessagePic,
                          EmojiReact: null,
                          Status: {
                            Delivered: false,
                            Seen: false,
                          },
                          Timestamp:
                            admin.firestore.FieldValue.serverTimestamp(),
                        });
                      tmp1
                        .collection("Messages")
                        .doc(value.data().email)
                        .collection("MyMessages")
                        .orderBy("Timestamp");
                    });
                })
                .catch(function (error) {
                  // The document probably doesn't exist.
                });
            }
          );
        } else if (
          (req.body.PostText && req.file === null) ||
          (req.body.PostText && !req.file)
        ) {
          const t = Date.now();
          tmp
            .collection("Messages")
            .doc(firebase.auth().currentUser.email)
            .collection("MyMessages")
            .add({
              MessageText: req.body.PostText,
              MessagePic: null,
              EmojiReact: null,
              Status: {
                Delivered: false,
                Seen: false,
              },
              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
              forSorting: Date.now(),
            })
            .then(function () {
              res.status(200).send("Document successfully updated!");
            })
            .then(function () {})
            .catch(function (error) {
              // The document probably doesn't exist.
            });
          db.collection("users")
            .doc(req.params.id)
            .get()
            .then((value) => {
              tmp1
                .collection("Messages")
                .doc(value.data().email)
                .collection("MyMessages")
                .add({
                  MessageText: req.body.PostText,
                  MessagePic: null,
                  EmojiReact: null,
                  Status: {
                    Delivered: false,
                    Seen: false,
                  },
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  forSorting: Date.now(),
                });
              tmp1
                .collection("Messages")
                .doc(value.data().email)
                .collection("MyMessages")
                .orderBy("forSorting");
            });

          tmp
            .collection("Messages")
            .doc(firebase.auth().currentUser.email)
            .collection("MyMessages")
            .orderBy("Timestamp");
        } else if (
          (req.file && !req.body.PostText) ||
          (req.file && req.body.PostText === null)
        ) {
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
            {
              public_id: `MessagePics/${uniqueFilename}`,
              tags: `MessagePics`,
            }, // directory and tags are optional
            function (err, image) {
              if (err) return res.send(err);
              console.log("file uploaded to Cloudinary");

              var fs = require("fs");
              fs.unlinkSync(path);

              MessagePic = image.secure_url;

              tmp
                .collection("Messages")
                .doc(firebase.auth().currentUser.email)
                .collection("MyMessages")
                .add({
                  MessageText: null,
                  MessagePic: MessagePic,
                  EmojiReact: null,
                  Status: {
                    Delivered: false,
                    Seen: false,
                  },
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                })
                .then(function () {
                  tmp
                    .collection("Messages")
                    .doc(firebase.auth().currentUser.email)
                    .collection("MyMessages")
                    .orderBy("Timestamp");
                  res.status(200).send("Document successfully updated!");
                })
                .then(function () {
                  db.collection("users")
                    .doc(req.params.id)
                    .get()
                    .then((value) => {
                      tmp1
                        .collection("Messages")
                        .doc(value.data().email)
                        .collection("MyMessages")
                        .add({
                          MessageText: null,
                          MessagePic: MessagePic,
                          EmojiReact: null,
                          Status: {
                            Delivered: false,
                            Seen: false,
                          },
                          Timestamp:
                            admin.firestore.FieldValue.serverTimestamp(),
                        });
                      tmp1
                        .collection("Messages")
                        .doc(value.data().email)
                        .collection("MyMessages")
                        .orderBy("Timestamp");
                    });
                })
                .then(function () {
                  tmp1
                    .collection("Messages")
                    .doc(value.data().email)
                    .collection("MyMessages")
                    .orderBy("Timestamp");
                })
                .catch(function (error) {
                  // The document probably doesn't exist.
                });
            }
          );
        }
      });
    } else {
      res.send("Oops! You cant message yourself!");
    }
  } else {
    res.send("Not authorized");
  }
};

//==================================================================

//Calling
exports.callsent = (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);
    if (tmp.id === user.uid) {
      tmp.collection("Call").doc(req.body.receiver).delete();
      tmp
        .collection("Call")
        .doc(req.body.receiver)
        .set(
          {
            Type: "Sender",
            Request: "Calling",
            to: req.body.receiver,
            start: Date.now(),
            End: 0,
            Duration: 0,
          },
          { merge: true }
        )
        .then(function () {
          res.status(200).send("Calling");
        })
        .catch(function (error) {
          res.status(400).send("error", error);
        });
      db.collection("users")
        .doc(req.body.receiver)
        .collection("Call")
        .doc(user.uid)
        .delete();
      db.collection("users")
        .doc(req.body.receiver)
        .collection("Call")
        .doc(user.uid)
        .set(
          {
            Type: "Reciever",
            Request: "Calling",
            from: user.uid,
            start: Date.now(),
            End: 0,
            Duration: 0,
          },
          { merge: true }
        )
        .then(function () {
          res.status(200).send("Calling");
        })
        .catch(function (error) {
          res.status(400).send("error", error);
        });
    } else {
      res.send("User is not authorized");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
};
//Call Recieved
exports.callrecieved = (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);
    if (tmp.id === user.uid) {
      tmp
        .collection("Call")
        .doc(req.body.sender)
        .update({
          Request: "Recieved",
        })
        .then(function () {
          res.status(200).send("Recieved");
        })
        .catch(function (error) {
          res.status(400).send("error", error);
        });
      db.collection("users")
        .doc(req.body.sender)
        .collection("Call")
        .doc(user.uid)
        .update({
          Request: "Recieved",
        })
        .then(function () {
          res.status(200).send("Recieved");
        })
        .catch(function (error) {
          res.status(400).send("error", error);
        });
    } else {
      res.send("User is not authorized");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
};
//Call Cancel
exports.callcancel = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then(async (decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);
    if (tmp.id === user.uid) {
      await tmp
        .collection("Call")
        .doc(req.body.receiver)
        .get()
        .then((value) => {
          userdata = value.data().start;
        });
      const duration = Date.now() - userdata;
      tmp
        .collection("Call")
        .doc(req.body.receiver)
        .update(
          {
            Request: "Cancelled",
            Duration: duration,
          },
          { merge: true }
        )
        .then(function () {
          res.status(200).send("Cancelled By the user");
        })
        .catch(function (error) {
          res.status(400).send("error", error);
        });
      db.collection("users")
        .doc(req.body.receiver)
        .collection("Call")
        .doc(user.uid)
        .update(
          {
            Request: "Cancelled",
            Duration: duration,
          },
          { merge: true }
        )
        .then(function () {
          res.status(200).send("Cancelled By the User");
        })
        .catch(function (error) {
          res.status(400).send("error", error);
        });
    } else {
      res.send("User is not authorized");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
};
//Call endby sender
exports.callsenderend = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then(async (decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);
    if (tmp.id === user.uid) {
      await tmp
        .collection("Call")
        .doc(req.body.receiver)
        .get()
        .then((value) => {
          userdata = value.data().start;
        });
      const duration = Date.now() - userdata;
      tmp
        .collection("Call")
        .doc(req.body.receiver)
        .update(
          {
            Request: "End",
            End: Date.now(),
            Duration: duration,
          },
          { merge: true }
        )
        .then(function () {
          res.status(200).send("End");
        })
        .catch(function (error) {
          res.status(400).send("error", error);
        });
      db.collection("users")
        .doc(req.body.receiver)
        .collection("Call")
        .doc(user.uid)
        .update(
          {
            Request: "End",
            End: Date.now(),
            Duration: duration,
          },
          { merge: true }
        )
        .then(function () {
          res.send("End");
        })
        .catch(function (error) {
          res.status(400).send("error");
        });
    } else {
      res.send("User is not authorized");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
  
};

//Schdule live
exports.schdulelive = (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
  
    var tmp = db.collection("users").doc(user.uid);
    if (tmp.id === user.uid) {
      cron.schedule(
        req.params.minute +
          " " +
          req.params.hour +
          " " +
          req.params.date +
          " " +
          req.params.month +
          " *",
        () => {
          tmp
            .collection("LiveNotifcation")
            .add(
              {
                minute: req.params.minute,
                hour: req.params.hour,
                date: req.params.date,
                month: req.params.month,
              },
              { merge: true }
            )
            .then(function () {
              res.status(200).send("Live Schedule Notification!");
            })
            .catch(function (error) {
              // res.status(400).send("error", error);
            });
        }
      );
      return res.status(200).send("Cron Job Initiated");
    } else {
      res.status(400).send("error", error);
    }
  }).catch(()=>{
    res.send('Wrong Id token')
  })
};

//==================================================================

//VIEW NOTIFICATION

exports.postSeen = (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);

    if (tmp.id != user.uid) {
      tmp1.collection("ProfilePic").get().then((picData)=>{
        picData.forEach((profilepic)=>{
          tmp1.get().then((userData)=>{
            
            tmp
            .collection("posts")
            .doc(req.params.pID)
            .collection("Seen")
            .doc(user.uid)  
            .set(
              {
                FirstName: userData.data().FirstName,
                LastName: userData.data().LastName,
                Username: userData.data().Username,
                Profilepic: profilepic.data().image_url,
              },
              { merge: true }
            )
            .then(function () {
              tmp
              .collection("posts")
              .doc(req.params.pID)
              .collection("Seen").get().then((data)=>{
                tmp
                .collection("posts")
                .doc(req.params.pID)
                .collection("TotalSeen")
                .doc(user.uid)  
                .set(
                  {
                    Total: data.size
                  },
                  { merge: true }
                )
                  res.send("You just viewed the post");
                })
                
              })
            .catch(function (error) {
              // The document probably doesn't exist.
              res.send("Error updating document: ", error);
            });

          })
        })
      })
      
    } else {
      res.send("You wont get notified by viewing your own post");
    }
  } else {
    res.send("Not authorized");
  }
};
exports.NotificationStatus = (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp1 = db.collection("users").doc(user.uid);

    if (tmp1.id === user.uid) {
      tmp1
        .collection("NotificationsTab")
        .doc(req.params.docID)
        .update({ Status: { Read: true } })
        .then(function () {
          res.send("Notification seen");
        })
        .catch(function (error) {
          // The document probably doesn't exist.
          res.send("Error updating document: ");
        });
    } else {
      res.send("Error viewing notification");
    }
  } else {
    res.send("Not authorized");
  }
};
exports.userView = (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);

    if (tmp.id != user.uid) {
      tmp
        .collection("Viewers")
        .doc(user.uid)
        .set(
          {
            ViewedBy: firebase.auth().currentUser.email,
          },
          { merge: true }
        )
        .then(function () {
          db.collection("users")
            .doc(user.uid)
            .get()
            .then((querySnapshot) => {
              var str1 = querySnapshot.data().FirstName;
              var str2 = querySnapshot.data().LastName;
              var result = str1.concat(" ", str2);
              var vi = "just viewed your profile";
              var Notification = result.concat(" ", vi);

              tmp.collection("NotificationsTab").add({ Notification, Timestamp: admin.firestore.FieldValue.serverTimestamp() });
            });

          res.send("You just viewed the user");
        })
        .catch(function (error) {
          // The document probably doesn't exist.
          res.send("Error updating document: ", error);
        });
    } else {
      res.send("You wont get notified by viewing yourself");
    }
  } else {
    res.send("Not authorized");
  }
};

exports.favUser = (req, res) =>{
  var user = firebase.auth().currentUser;
  var postData = [];
  var totalLikes = [];
  if (user) {
    var tmp = db.collection("users").doc(user.uid);
    var tmp1 = db.collection("users").doc(req.params.id);
    var posts = db.collection("users").doc(req.params.id).collection("posts").get().then((doc)=>{
      if(!doc.docs || doc.size == 0){
        console.log('hehe size',doc.size);
        tmp1.get().then((favUser)=>{
          tmp1.collection("ProfilePic").get().then((pic)=>{
          if(!pic){
            console.log("earth");
            tmp.collection("FavouriteUsers").doc(req.params.id).set({
              post: postData,
              
              likes: totalLikes,
              whoPosted:{
                firstname: favUser.data().FirstName,
                lastname: favUser.data().LastName,
                id: req.params.id,
                image: null
              }
            }).then(()=>{
              res.send("Document updated successfully")
            })
          }
          else{
            console.log('bigg ',doc.size);
            pic.forEach((picId)=>{
              tmp1.collection("ProfilePic").doc(picId.id).get().then((picData)=>{
                tmp.collection("FavouriteUsers").doc(req.params.id).set({
                post: postData,
                postId: null,
                likes: totalLikes,
                whoPosted:{
                  firstname: favUser.data().FirstName,
                  lastname: favUser.data().LastName,
                  id: req.params.id,
                  image: picData.data()
                }
               }).then(()=>{
                res.send("Document updated successfully")
                })
              })
             })
          }
            
          })
        })
      }
      else{
        console.log("object", doc.size);
        doc.forEach((payload)=>{
          
          db.collection("users").doc(req.params.id).collection("posts").doc(payload.id).collection("Liked").get().then((likes)=>{
            
            if(!likes || likes.size == 0){
              postData.push({postdata:payload.data(), postId: payload.id, postLikes: null});
              tmp1.get().then((favUser)=>{
                tmp1.collection("ProfilePic").get().then((pic)=>{
                if(!pic){
                  console.log("earth");
                  tmp.collection("FavouriteUsers").doc(req.params.id).set({
                    post: postData,
                    
                     likes: null,
                    whoPosted:{
                      firstname: favUser.data().FirstName,
                      lastname: favUser.data().LastName,
                      id: req.params.id,
                      image: null
                    }
                  }).then(()=>{
                    res.send("Document updated successfully")
                  })
                }
                else{
                  pic.forEach((picId)=>{
                    tmp1.collection("ProfilePic").doc(picId.id).get().then((picData)=>{
                      tmp.collection("FavouriteUsers").doc(req.params.id).set({
                      post: postData,
                      postId: payload.id,
                      likes: null,
                      whoPosted:{
                        firstname: favUser.data().FirstName,
                        lastname: favUser.data().LastName,
                        id: req.params.id,
                        image: picData.data()
                      }
                     }).then(()=>{
                      res.send("Document updated successfully")
                      })
                    })
                   })
                }
                  
                })
              })
            }
            console.log(likes);
            likes.forEach((totalLikes)=>{
              postData.push({postdata:payload.data(), postId: payload.id, postLikes: totalLikes});
              tmp1.get().then((favUser)=>{
                tmp1.collection("ProfilePic").get().then((pic)=>{
                if(!pic){
                  console.log("earth");
                  tmp.collection("FavouriteUsers").doc(req.params.id).set({
                    post: postData,
                    
                    // likes: totalLikes,
                    whoPosted:{
                      firstname: favUser.data().FirstName,
                      lastname: favUser.data().LastName,
                      id: req.params.id,
                      image: null
                    }
                  }).then(()=>{
                    res.send("Document updated successfully")
                  })
                }
                else{
                  pic.forEach((picId)=>{
                    tmp1.collection("ProfilePic").doc(picId.id).get().then((picData)=>{
                      tmp.collection("FavouriteUsers").doc(req.params.id).set({
                      post: postData,
                      postId: payload.id,
                      likes: totalLikes.data(),
                      whoPosted:{
                        firstname: favUser.data().FirstName,
                        lastname: favUser.data().LastName,
                        id: req.params.id,
                        image: picData.data()
                      }
                     }).then(()=>{
                      res.send("Document updated successfully")
                      })
                    })
                   })
                }
                  
                })
              })
            })
          })
        })
      }
    });
  }
}



exports.favUserGet = (req, res) =>{
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(user.uid);
    var tmp1 = db.collection("users").doc(req.params.id);

    tmp.collection("FavouriteUsers").get().then((data) =>{
      if(data.size == 0){
        res.send("No favourite users")
      }
      data.forEach((payload)=>{
        console.log(payload.data());
        res.json(payload.data());
      })
    })
  }
}

exports.getFollowingData = async (req, res) =>{
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var idData = []
    var name = []
    var pics = []
    var tmp = db.collection("users").doc(user.uid);
    await tmp.collection("Following").get().then((doc)=>{
      console.log("doc",doc);
      doc.forEach((payload)=>{
        console.log("object", payload.id);
        idData.push(payload.id)
         db.collection("users").doc(payload.id).get().then((userData)=>{
           name.push({firstname:userData.data().FirstName, lastname: userData.data().LastName})

           db.collection("users").doc(payload.id).collection("ProfilePic").get().then((pic)=>{
            if(pic.size == 0){
              pics.push(null)
              // res.send({name, pic: null})
            }
            pic.forEach((picData)=>{
              pics.push(picData.data().image_url)
              
              //res.send({name, pic: pics})
  
            })
          })
          res.send({id: idData,name, pic: pics})
        })
        
      })
    })
    //res.send(name)
  }else{
    res.send("User not authorized")
  }
}

exports.EditUserData = (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(user.uid);
    if (tmp.id === user.uid) {
      if(!req.body.FirstName){
        if(!req.body.LastName){
          if(!req.body.email){
          console.log("not lastname not firstname not email");
          res.send('Provide valid info')
          
          }
          console.log("not lastname not firstname yes email");
          user.updateEmail(req.body.email).then(()=>{
            tmp.update({
              email:req.body.email
            }).then(()=>{
              res.send('Email changed')
            })
          })
          
        }
        if(req.body.LastName){
          if(!req.body.email){
          console.log("yes lastname not firstname not email");
          tmp.update({
            LastName:req.body.LastName
          }).then(()=>{
            res.send('Lastname changed')
          })
          }
          if(req.body.email){
          console.log("yes lastname not firstname yes email");
          user.updateEmail(req.body.email).then(()=>{
            tmp.update({
              LastName:req.body.LastName,
              email:req.body.email
            }).then(()=>{
              res.send('Email and lastname changed')
            })
          })
          
          }
        }
      }
      else if(req.body.FirstName){
        if(!req.body.LastName){
          if(!req.body.email){
          console.log("not lastname yes firstname not email");
          tmp.update({
            FirstName:req.body.FirstName
          }).then(()=>{
            res.send('Firstname changed')
          })

          }
          else if(req.body.email){

            console.log("not lastname yes firstname yes email");
            user.updateEmail(req.body.email).then(()=>{
              tmp.update({
                FirstName:req.body.FirstName,
                email:req.body.email
              }).then(()=>{
                res.send('Email and firstname changed')
              })
            })
          }
        }
        else if(req.body.LastName){
          if(!req.body.email){
            console.log("yes lastname yes firstname not email");
            tmp.update({
              FirstName:req.body.FirstName,
              LastName:req.body.LastName
            }).then(()=>{
              res.send('Firstname and Lastname changed')
            })

          }
          else if(req.body.email){
            console.log("yes lastname yes firstname yes email");
            user.updateEmail(req.body.email).then(()=>{
              tmp.update({
                FirstName:req.body.FirstName,
                LastName:req.body.LastName,
                email:req.body.email
              }).then(()=>{
                res.send('Firstname, Lastname and Email changed')
              })
            })
          }
        }

      }
    } else {
      res.send("Not authorized");
    }
  } else {
    res.send("Not authorized");
  }
};

exports.about = (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(user.uid);

    if (tmp.id === user.uid) {
      return tmp
        .update({
          About: req.body.about,
        })
        .then(function () {
          res.send("About section updated!");
        })
        .catch(function (error) {
          // The document probably doesn't exist.
          res.send("Error updating About section: ", error);
        });
    } else {
      res.send("Not authorized");
    }
  } else {
    res.send("Not authorized");
  }
};
exports.goLive = (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(user.uid);

    if (tmp.id === user.uid) {
      return tmp
        .collection("Live")
        .add({
          isLive: true,
        })
        .then(function () {
          db.collection("users")
            .doc(user.uid)
            .get()
            .then((value) => {
              var username = value.data().Username;
              var vi = "just went live.";
              var Notification = username.concat(" ", vi);
              db.collection("users")
                .doc(user.uid)
                .collection("Followers")
                .get()
                .then((val) => {
                  val.forEach((doc) => {
                    db.collection("users")
                      .doc(doc.id)
                      .collection("NotificationsTab")
                      .add({
                        Notification,
                        Timestamp: admin.firestore.FieldValue.serverTimestamp()
                      });
                  });
                });
            });

          res.send("User just went live!");
        })
        .catch(function (error) {
          // The document probably doesn't exist.
          res.send("Error going live: ", error);
        });
    } else {
      res.send("Not authorized");
    }
  } else {
    res.send("Not authorized");
  }
};

async function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy("__name__").limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

exports.quitLive = async (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);

    if (tmp.id === user.uid) {
      const live = tmp.collection("Live");
      const snapshot = await live.where("isLive", "==", true).get();
      //const reds = await db.collection("users").doc("DC").delete();
      if (snapshot.empty) {
        res.send("No matching documents.");
        return;
      }

      snapshot.forEach((doc) => {
        console.log(doc.id, "=>", doc.data());
        const session = tmp.collection("Live");
        session
          .where("isLive", "==", true)
          .get()
          .then(function (querySnapshot) {
            // Once we get the results, begin a batch
            var batch = db.batch();

            querySnapshot.forEach(function (doc) {
              // For each doc, add a delete operation to the batch
              
              batch.delete(doc.ref);
            });
            const comm = session.doc("comments");
            // Commit the batch
            return batch.commit();
          })
          .then(function () {
            res.send("User quitted");
            // ...
          })
          .catch(function (error) {
            res.send("Error quitting session: ");
          });
      });
      res.send("Deleted succesfully");
    } else {
      res.send("Not authorized");
    }
  } else {
    res.send("Not authorized");
  }
};

exports.liveViewsCount = async (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
 
    tmp
      .collection("Live")
      .doc(req.params.liveID)
      .collection("Viewers")
      .doc(req.params.id)
      .set({
        ViewCount: 0,
      });
    tmp
      .collection("Live")
      .doc(req.params.liveID)
      .collection("Viewers")
      .doc(req.params.id)
      .update({
        ViewCount: 0,
        ViewCount: admin.firestore.FieldValue.increment(1),
      })
      .then(function () {
        res.send("Watching live stream now!");
      });
  } else {
    res.send("Not authorized");
  }
};

exports.liveComment = async (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);

    const live = tmp.collection("Live");
    const snapshot = await live.where("isLive", "==", true).get();
    if (snapshot.empty) {
      console.log("No matching documents.");
      return;
    }

    return snapshot.forEach((doc) => {
      console.log(doc.id, "=>", doc.data());
      db.collection("users")
        .doc(user.uid)
        .get()
        .then((querySnapshot) => {
          tmp
            .collection("Live")
            .doc(req.params.liveID)
            .collection("comments")
            .add({
              Comment: {
                Username: querySnapshot.data().Username,
                Comment: req.body.comment,
                react: req.body.emoji ? req.body.emoji: null
              },
            });
        })
        .then(function () {
          res.send("Comment has been added!");
        })
        .catch(function () {
          // The document probably doesn't exist.
          res.send("Error commenting");
        });
    });
  } else {
    res.send("Not authorized");
  }
};

exports.dailySub = (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    if (tmp.id === user.uid) {
      return tmp
        .collection("Subscription")
        .add({
          daily: true,
          SubscribedAt: new Date().toISOString(),
        })
        .then(function () {
          res.send("Daily subsciption added!");
        })
        .catch(function (error) {
          // The document probably doesn't exist.
          res.send("Error going live: ", error);
        });
    } else {
      res.send("Not authorized");
    }
  } else {
    res.send("Not authorized");
  }
};
exports.weeklySub = (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    if (tmp.id === user.uid) {
      return tmp
        .collection("Subscription")
        .add({
          weekly: true,
          SubscribedAt: new Date().toISOString(),
        })
        .then(function () {
          res.send("Weekly subsciption added!");
        })
        .catch(function (error) {
          // The document probably doesn't exist.
          res.send("Error going live: ", error);
        });
    } else {
      res.send("Not authorized");
    }
  } else {
    res.send("Not authorized");
  }
};
exports.monthlySub = (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    if (tmp.id === user.uid) {
      return tmp
        .collection("Subscription")
        .add({
          monthly: true,
          SubscribedAt: new Date().toISOString(),
        })
        .then(function () {
          res.send("Monthly subsciption added!");
        })
        .catch(function (error) {
          // The document probably doesn't exist.
          res.send("Error going live: ", error);
        });
    } else {
      res.send("Not authorized");
    }
  } else {
    res.send("Not authorized");
  }
};

//LIKING A POST

exports.postsLike = async (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    const value = await db
      .collection("users")
      .doc(req.params.id)
      .collection("posts")
      .doc(req.params.pID)
      .collection("Liked")
      .doc(user.uid)
      .get();

    if (value.exists) {
      console.log("user already liked the post");
      res.send("User already liked the post");
    } else {
      db.collection("users")
        .doc(user.uid)
        .get()
        .then((querySnapshot) => {
          var str1 = querySnapshot.data().FirstName;
          var str2 = querySnapshot.data().LastName;
          var result = str1.concat(" ", str2);

          db.collection("users")
            .doc(req.params.id)
            .collection("posts")
            .doc(req.params.pID)
            .collection("Liked")
            .doc(user.uid)
            .set({
              Liked: result,
            });

          var vi = "just liked the post.";
          var Notification = result.concat(" ", vi);

          db.collection("users")
            .doc(req.params.id)

            .collection("NotificationsTab")
            .add({ Notification, Status: { Read: false }, Timestamp: admin.firestore.FieldValue.serverTimestamp() });

          db.collection("users")
            .doc(req.params.id)
            .collection("posts")
            .doc(req.params.pID)
            .collection("Liked")
            .get()
            .then((snap) => {
              size = snap.size;

              db.collection("users")
                .doc(req.params.id)
                .collection("posts")
                .doc(req.params.pID)
                .collection("TotalLikes")
                .doc(req.params.id)
                .set({
                  Total: size,
                });
            });
        });

      res.status(200).send("Post Liked");
    }
  } else res.send("Not authorized");
};

exports.PostShareAsMessage = async (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);

    db.collection("users")
      .doc(user.uid)
      .get()
      .then((querySnapshot) => {
        var str1 = querySnapshot.data().FirstName;
        var str2 = querySnapshot.data().LastName;
        var result = str1.concat(" ", str2);
        var vi = "just shared a post with you";
        var Notification = result.concat(" ", vi);

        tmp1.get().then((value) => {
          db.collection("users")
            .doc(req.params.receiverID)
            .collection("Messages")
            .doc(firebase.auth().currentUser.email)
            .collection("MyMessages")
            .add({
              SharedBy: value.data().Username,
              Post: {
                PostID: req.params.postID,
                AuthorID: req.params.authorID,
              },
            })
            .then((val) => {
              res.send("Post sent!");
              db.collection("users")
                .doc(req.params.receiverID)
                .collection("NotificationsTab")
                .add({ Notification, Status: { Read: false }, Timestamp: admin.firestore.FieldValue.serverTimestamp() });
            });
        });
      });
  } else {
    res.send("not authorized");
  }
};
exports.postsShare = async (req, res) => {
  var user = firebase.auth().currentUser;
  //console.log(user.uid);
  if (user) {
    var tmp = db.collection("users").doc(req.params.id);
    var tmp1 = db.collection("users").doc(user.uid);

    db.collection("users")
      .doc(user.uid)
      .get()
      .then((querySnapshot) => {
        var str1 = querySnapshot.data().FirstName;
        var str2 = querySnapshot.data().LastName;
        var result = str1.concat(" ", str2);

        tmp
          .collection("posts")
          .doc(req.params.pID)
          .collection("Shared")
          .add({
            Name: result,
          })
          .then(function () {
            db.collection("users")
              .doc(user.uid)
              .get()
              .then((querySnapshot) => {
                var str1 = querySnapshot.data().FirstName;
                var str2 = querySnapshot.data().LastName;
                var result = str1.concat(" ", str2);
                var vi = "just shared your post.";
                var Notification = result.concat(" ", vi);
                tmp.get().then((value) => {
                  var str1 = value.data().FirstName;
                  var str2 = value.data().LastName;
                  var result = str1.concat(" ", str2);
                  tmp1.collection("SharedPosts").add({
                    SharedFrom: result,
                    PostID: req.params.pID,
                  });
                });

                db.collection("users")
                  .doc(req.params.id)
                  .collection("NotificationsTab")
                  .add({ Notification, Status: { Read: false }, Timestamp: admin.firestore.FieldValue.serverTimestamp() });
              });
            db.collection("users")
              .doc(req.params.id)
              .collection("posts")
              .doc(req.params.pID)
              .collection("Shared")
              .get()
              .then((snap) => {
                size = snap.size;

                db.collection("users")
                  .doc(req.params.id)
                  .collection("posts")
                  .doc(req.params.pID)
                  .collection("TotalShares")
                  .doc(req.params.id)
                  .set({
                    Total: size,
                  });
              });
            tmp
              .collection("posts")
              .doc(req.params.pID)
              .collection("Shared")
              .get()
              .then((snap) => {
                size = snap.size;

                db.collection("users")
                  .doc(req.params.id)
                  .collection("posts")
                  .doc(req.params.pID)
                  .collection("TotalShares")
                  .doc(req.params.id)
                  .set({
                    Total: size,
                  });
              });

            res.status(200).send("Post Shared");
          });
      });
  }
};

exports.postsComments = async (req, res) => {
  var user = firebase.auth().currentUser;
  
  if (user) {
    
    docID = [];
    var tmp = db.collection("users").doc(req.params.id);

    db.collection("users")
      .doc(user.uid)
      .get()
      .then((querySnapshot) => {
        db.collection("users").doc(user.uid).collection("ProfilePic").get().then((doc)=>{
          console.log(doc.docs.length);
          if(doc.docs.length <= 0){
            var str1 = querySnapshot.data().FirstName;
            var str2 = querySnapshot.data().LastName;
            var result = str1.concat(" ", str2);
    
            tmp
              .collection("posts")
              .doc(req.params.pID)
              .collection("Comments")
              .add({
                Name: result,
                CommentText: req.body.comment,
                Pic: null,
                Timestamp: admin.firestore.FieldValue.serverTimestamp(),
              })
    
              .then(function () {
                db.collection("users")
                  .doc(user.uid)
                  .get()
                  .then((querySnapshot) => {
                    var str1 = querySnapshot.data().FirstName;
                    var str2 = querySnapshot.data().LastName;
                    var result = str1.concat(" ", str2);
                    var vi = "just commented on your post.";
                    var Notification = result.concat(" ", vi);
    
                    tmp
                      .collection("NotificationsTab")
                      .add({ Notification, Status: { Read: false }, Timestamp: admin.firestore.FieldValue.serverTimestamp() });
                  });
                db.collection("users")
                  .doc(req.params.id)
                  .collection("posts")
                  .doc(req.params.pID)
                  .collection("Comments")
                  .get()
                  .then((snap) => {
                    size = snap.size;
    
                    db.collection("users")
                      .doc(req.params.id)
                      .collection("posts")
                      .doc(req.params.pID)
                      .collection("TotalComments")
                      .doc(req.params.id)
                      .set({
                        Total: size,
                      });
                  });
                tmp
                  .collection("posts")
                  .doc(req.params.pID)
                  .collection("Comments")
                  .get()
                  .then((snap) => {
                    size = snap.size;
    
                    db.collection("users")
                      .doc(req.params.id)
                      .collection("posts")
                      .doc(req.params.pID)
                      .collection("TotalComments")
                      .doc(req.params.id)
                      .set({
                        Total: size,
                      });
                  });
    
                res.status(200).send("Comment posted");
              });
          }
          doc.forEach((pic)=>{
          console.log("light si");
          var str1 = querySnapshot.data().FirstName;
          var str2 = querySnapshot.data().LastName;
          var result = str1.concat(" ", str2);
  
          tmp
            .collection("posts")
            .doc(req.params.pID)
            .collection("Comments")
            .add({
              Name: result,
              CommentText: req.body.comment,
              Pic: pic.data(),
              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
            })
  
            .then(function () {
              db.collection("users")
                .doc(user.uid)
                .get()
                .then((querySnapshot) => {
                  var str1 = querySnapshot.data().FirstName;
                  var str2 = querySnapshot.data().LastName;
                  var result = str1.concat(" ", str2);
                  var vi = "just commented on your post.";
                  var Notification = result.concat(" ", vi);
  
                  tmp
                    .collection("NotificationsTab")
                    .add({ Notification, Status: { Read: false }, Timestamp: admin.firestore.FieldValue.serverTimestamp() });
                });
              db.collection("users")
                .doc(req.params.id)
                .collection("posts")
                .doc(req.params.pID)
                .collection("Comments")
                .get()
                .then((snap) => {
                  size = snap.size;
  
                  db.collection("users")
                    .doc(req.params.id)
                    .collection("posts")
                    .doc(req.params.pID)
                    .collection("TotalComments")
                    .doc(req.params.id)
                    .set({
                      Total: size,
                    });
                });
              tmp
                .collection("posts")
                .doc(req.params.pID)
                .collection("Comments")
                .get()
                .then((snap) => {
                  size = snap.size;
  
                  db.collection("users")
                    .doc(req.params.id)
                    .collection("posts")
                    .doc(req.params.pID)
                    .collection("TotalComments")
                    .doc(req.params.id)
                    .set({
                      Total: size,
                    });
                });
  
              res.status(200).send("Comment posted");
            });
            
          })
        }).catch((err)=>{
          
          console.log(err);
        })
      });
  } else {
    res.send("Not authorized");
  }
  // else {
  //   res.send("Not authorized");
  // }
};

exports.fetchusercollections = (req, res) => {
  var user = firebase.auth().currentUser;
  var dummy = [];
  if (user) {
    var tmp = db
      .collection("users")
      .doc(user.uid)
      .collection(req.params.col)
      .get()
      .then((snapshot) => {
        // res.send(snapshot);
        snapshot.forEach((doc) => {
          dummy.push(doc.data());
          console.log(doc.data());
        });
      })
      .then(() => {
        res.send(dummy);
      });
  } else {
    res.send("Not authorized");
  }
};
////////////////////////////////////
exports.fetchfavouritepost = async (req, res) => {
  var user = firebase.auth().currentUser;
  var dummy = [];
  if (user) {
    var length = 0;
    var slength = 1;
  await db.collection("users")
      .doc(user.uid)
      .collection("FavouritePosts")
      .get()
      .then((snapshot) => {
        snapshot.forEach((doc) => {
          length = length + 1;
        });
      });
    
  await db.collection("users")
      .doc(user.uid)
      .collection("FavouritePosts")
      .get()
      .then((snapshot) => {
        
         snapshot.forEach(async (doc) => {
           let data=[]
          slength = slength + 1;
          await db.collection("users")
            .doc(doc.data().FavPostUserId)
            .get()
            .then((d) => {
            data.push({"name":d.data().FirstName,"date":d.data().DateOfBirth})
            }).catch((err)=>{
              console.log(err)
            }); 
      await db.collection("users")
            .doc(doc.data().FavPostUserId)
            .collection("posts")
            .doc(doc.data().PostID)
            .get()
            .then((docc) => {
            
              dummy.push({"User":data,"psot":docc.data()});
            
              if (dummy.length===length) {
                res.send(dummy);               
              }
            }).catch((err)=>{
              console.log(err)
            }); 
        })
       
      });
     
  } else {
    res.send("Not authorized");
  }
};
////////////////////////////////////
/////////////////////////////////////
exports.fetchAnyOtheInfo = (req, res) => {
  var user = firebase.auth().currentUser;
  var dummy = [];
  if (user) {
    var tmp = db
      .collection("users")
      .doc(req.params.id)
      .collection(req.params.col)
      .get()
      .then((snapshot) => {
        // res.send(snapshot);
        snapshot.forEach((doc) => {
          dummy.push(doc.data());
          console.log(doc.data());
        });
      })
      .then(() => {
        res.send(dummy);
      });
  } else {
    res.send("Not authorized");
  }
};

exports.setFavourites = async (req, res) => {
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    console.log("Not authorized");
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then(async (decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);

    var tmp1 = db.collection("users").doc(req.params.id);

    const doc = await tmp1.get();

    let fav = doc.data().email;

    const par = req.params.id;

    if (par !== user.uid) {
      return tmp
        .set(
          {
            MyFavourites: {
              favourites: admin.firestore.FieldValue.arrayUnion(fav),
              Total: 1,
              Total: admin.firestore.FieldValue.increment(1),
            },
          },
          { merge: true }
        )
        .then(function () {
          res.send("User is selected as favourite!");
        })
        .catch(function (error) {
          // The document probably doesn't exist.
          res.send("Error updating document: ", error);
        });
    } else {
      res.send("You cant favourite yourself");
    }
  
  }).catch(()=>{
    res.send('Wrong Id token')
  })
  
};


//token generate and add card

exports.addCardAndGenerateToken =async (req, res) => {
  var user = firebase.auth().currentUser;
  stripe.tokens
  .create({
    card: {
      number: req.body.number,
      exp_month: req.body.exp_month,
      exp_year: req.body.exp_year,
      cvc: req.body.cvc,
    },
  })
  .then(function (response) {
    res.send(response.id);
  })
  .catch((error) => {
    return res.status(500).send({
      success: false,
      data: error,
    });
  });
};

//charging money api
exports.chargeCardUsingToken =async (req, res) => {
  var user = firebase.auth().currentUser;
  if(user){
    stripe.paymentIntents.create({
      amount: parseFloat(req.body.amount) * 100,
      currency: 'usd',
      payment_method_types: ['card'],
    }).then(paymentIntent => {
      stripe.paymentIntents.confirm(
        paymentIntent.id,
        {payment_method: 'pm_card_visa'}
        ).then(paymentConfirmation => {
          res.send(paymentConfirmation);
          const result =  db.collection("users").doc(user.uid).collection("Subscription")
          result.doc(user.uid).set({
            paymentId: paymentConfirmation.id, Amount:(paymentConfirmation.amount / 100), timestamp: admin.firestore.FieldValue.serverTimestamp(), isRefunded: false
          }).then((data)=>{
            res.send("Payment charged", data);
          }).catch((e)=>{
            res.send(e.message)
          })
        })
    })
  }else{
    res.send("Not authorized")
  }
};


//refund api
exports.refundUsingStripeId =async (req, res) => {
  var user = firebase.auth().currentUser;
  if(user){
    const result =  db.collection("users").doc(user.uid).collection("Subscription").doc(user.uid)
  
    result.get().then((data)=>{
      const day = moment(data.data().timestamp).endOf('day').calendar()
      if(data.data().Amount == 50){
        stripe.refunds.create({
          payment_intent: req.body.paymentId,
        })
          .then((response) => {
            res.send(response);
          })
          .catch((error) => {
            console.log(error);
            return res.status(500).send({
              success: false,
              data: error,
            });
          });
      }
      console.log("object", day);
      console.log("cool",data.data().timestamp);
    })
  }else{
    res.send("Not authorized")
  } 
};

exports.logOut = (req, res) => {
  var user = firebase.auth().currentUser;
  console.log("loggined", user.uid);
  firebase
    .auth()
    .signOut()
    .then(function () {
      return res
        .status(200)
        .json({ message: "User has successfully logged out" });
    })
    .catch(function (error) {
      return res.status(400).json({ message: "error", error });
    });
};




exports.editPost = async (req, res) =>{
  const idToken = req.headers.authorization
  var user = firebase.auth().currentUser;
  if(!user){
    res.send("Not authorized")
  }
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    var tmp = db.collection("users").doc(user.uid);

    tmp.get().then((post)=>{
      if(!post){
        res.send('Post not found')
      }
      const upload = multer({ storage }).single("display");
      upload(req, res, function (err) {
        if (err) {
          return res.send(err);
        }
        
        let image_url = null;
        console.log("file uploaded to server");

        if (req.file && req.body.PostText) {
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
            { public_id: `PostsPics/${uniqueFilename}`, tags: `PostsPics` }, // directory and tags are optional
            function (err, image) {
              if (err) return res.send(err);
              console.log("file uploaded to Cloudinary");

              var fs = require("fs");
              fs.unlinkSync(path);

              image_url = image.secure_url;
              if(req.body.fontname == 'Nimla'|| req.body.fontname == 'Poppins' || req.body.fontname == 'Monster'){
                return tmp
                .collection("posts").doc(req.params.postId)
                .update(
                  {
                    image_url: image_url,
                    PostText: req.body.PostText,
                    Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    fontName: req.body.fontname,
                    Bold: req.body.bold?req.body.bold:null,
                    Underline: req.body.underline?req.body.underline:null,
                    Italic: req.body.italic?req.body.italic:null,
                    scheduled:false

                  },
                  { merge: true }
                )
                .then(function async(res) {
                  db.collection("users")
                    .doc(user.uid)
                    .collection("Followers")
                    .get()
                    .then((value) => {
                      value.forEach((doc) => {
                        db.collection("users")
                          .doc(doc.id)
                          .collection("NewsFeed").doc(req.params.postId)
                          .update({
                            image_url: image_url,
                            PostText: req.body.PostText,
                            Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            fontName: req.body.fontname,
                            Bold: req.body.bold?req.body.bold:null,
                            Underline: req.body.underline?req.body.underline:null,
                            Italic: req.body.italic?req.body.italic:null,

                            
                          });
                      });
                    });

                  db.collection("users")
                    .doc(user.uid)
                    .collection("posts")
                    .get()
                    .then((snap) => {
                      size = snap.size; // will return the collection size
                      db.collection("users")
                        .doc(user.uid)
                        .collection("TotalPosts")
                        .doc(user.uid)
                        .set({
                          Total: 0,
                        });
                    });

                  db.collection("users")
                    .doc(user.uid)
                    .collection("posts")
                    .get()
                    .then((snap) => {
                      size = snap.size;
                      console.log(size); // will return the collection size
                      db.collection("users")
                        .doc(user.uid)
                        .collection("TotalPosts")
                        .doc(user.uid)
                        .set({
                          Total: size,
                        });
                    });
                })
                .then(function () {
                  res.status(200).send("Document successfully updated!");
                })
                .catch(function (error) {
                  // The document probably doesn't exist.
                  //res.status(400).send("error", error);
                  //res.status(404).send("Error updating document: ", error);
                });
              }else{
                res.send("Wrong fontname")
              }
              
              //res.json(image);
            }
          );
        } else if (
          (req.body.PostText && req.file === null) ||
          (req.body.PostText && !req.file)
        ) {
          console.log("no file", req.file);
          if(req.body.fontname == 'Nimla'|| req.body.fontname == 'Poppins' || req.body.fontname == 'Monster'){
            return tmp
            .collection("posts").doc(req.params.postId)
            .update(
              {
                image_url: image_url,
                PostText: req.body.PostText,
                Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                fontName: req.body.fontname,
                Bold: req.body.bold?req.body.bold:null,
                Underline: req.body.underline?req.body.underline:null,
                Italic: req.body.italic?req.body.italic:null,
                scheduled:false

              },
              { merge: true }
            )
            .then(function (res) {
              db.collection("users")
                .doc(user.uid)
                .collection("Followers")
                .get()
                .then((value) => {
                  value.forEach((doc) => {
                    db.collection("users")
                      .doc(doc.id)
                      .collection("NewsFeed").doc(req.params.postId)
                      .update({
                        image_url: image_url,
                        PostText: req.body.PostText,
                        Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        fontName: req.body.fontname,
                        Bold: req.body.bold?req.body.bold:null,
                        Underline: req.body.underline?req.body.underline:null,
                        Italic: req.body.italic?req.body.italic:null,

                        
                      });
                  });
                });

              db.collection("users")
                .doc(user.uid)
                .collection("posts")
                .get()
                .then((snap) => {
                  size = snap.size; // will return the collection size
                  db.collection("users")
                    .doc(user.uid)
                    .collection("TotalPosts")
                    .doc(user.uid)
                    .set({
                      Total: 0,
                    });
                });

              db.collection("users")
                .doc(user.uid)
                .collection("posts")
                .get()
                .then((snap) => {
                  size = snap.size;
                  console.log(size); // will return the collection size
                  db.collection("users")
                    .doc(user.uid)
                    .collection("TotalPosts")
                    .doc(user.uid)
                    .set({
                      Total: size,
                    });
                });
            })
            .then(function () {
              res.status(200).send("Document successfully updated!");
            })
            .catch(function (error) {
              // The document probably doesn't exist.
              //res.status(400).send("error", error);
              //res.status(404).send("Error updating document: ", error);
            });
            // if(req.body.bold && !req.body.underline && !req.body.italic){
          }else{
            res.send("Wrong fontname")
          }
        }

        if (
          (req.file && !req.body.PostText) ||
          (req.file && req.body.PostText === null)
        ) {
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
            { public_id: `PostsPics/${uniqueFilename}`, tags: `PostsPics` }, // directory and tags are optional
            function (err, image) {
              if (err) return res.send(err);
              console.log("file uploaded to Cloudinary");

              var fs = require("fs");
              fs.unlinkSync(path);

              image_url = image.secure_url;
              console.log(image_url);
                return tmp
                    .collection("posts").doc(req.params.postId)
                    .update(
                      {
                        image_url: image_url,
                        PostText: null,
                        Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        fontName: null,
                        Bold: null,
                        Underline: null,
                        Italic: null,
                        scheduled:false,
                      },
                      { merge: true }
                    )
                    .then(function (res) {
                     
                      db.collection("users")
                        .doc(user.uid)
                        .collection("Followers")
                        .get()
                        .then((value) => {
                          value.forEach((doc) => {
                            db.collection("users")
                              .doc(doc.id)
                              .collection("NewsFeed").doc(req.params.postId)
                              .update({
                                image_url: image_url,
                                PostText: null,
                                Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                fontName: null,
                                Bold: null,
                                Underline: null,
                                Italic: null,
                              });
                          });
                        });
                      db.collection("users")
                        .doc(user.uid)
                        .collection("posts")
                        .get()
                        .then((snap) => {
                          size = snap.size; // will return the collection size
                          db.collection("users")
                            .doc(user.uid)
                            .collection("TotalPosts")
                            .doc(user.uid)
                            .set({
                              Total: 0,
                            });
                        });
    
                      db.collection("users")
                        .doc(user.uid)
                        .collection("posts")
                        .get()
                        .then((snap) => {
                          size = snap.size; // will return the collection size
                          db.collection("users")
                            .doc(user.uid)
                            .collection("TotalPosts")
                            .doc(user.uid)
                            .set({
                              Total: size,
                            });
                        });
                    })
                    .then(function () {
                      res.status(200).send("Document successfully updated!");
                    })
                    .catch(function (error) {
                      // The document probably doesn't exist.
                      res.status(400).send("error", error);
                      //res.status(404).send("Error updating document: ", error);
                    });
              
              //res.json(image);
            }
          );
        }

        // SEND FILE TO CLOUDINARY
      });
      
    })

  })
}


exports.schedulepost = async (req, res) => {
    const idToken = req.headers.authorization
    var user = firebase.auth().currentUser;
    const fontName = ['Nimla', 'Poppins', 'Monster']
  admin
  .auth()
  .verifyIdToken(idToken)
  .then((decodedToken) => {
    if(!user){
      console.log("Not authorized  5444554");
      res.send("Not authorized")
    }
    else {
      var tmp = db.collection("users").doc(user.uid);
  
      if (tmp.id === user.uid) {
        console.log(tmp.id);
  
        console.log(user.uid);
        const upload = multer({ storage }).single("display");
  
        upload(req, res, function (err) {
          if (err) {
            return res.send(err);
          }
          
          let image_url = null;
          console.log("file uploaded to server");
  
          if (req.file && req.body.PostText) {
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
              { public_id: `PostsPics/${uniqueFilename}`, tags: `PostsPics` }, // directory and tags are optional
              function (err, image) {
                if (err) return res.send(err);
                console.log("file uploaded to Cloudinary");
  
                var fs = require("fs");
                fs.unlinkSync(path);
  
                image_url = image.secure_url;
                if(req.body.fontname == 'Nimla'|| req.body.fontname == 'Poppins' || req.body.fontname == 'Monster'){
                  return tmp
                  .collection("posts")
                  .add(
                    {
                      image_url: image_url,
                      PostText: req.body.PostText,
                      Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      fontName: req.body.fontname,
                      Bold: req.body.bold?req.body.bold:null,
                      Underline: req.body.underline?req.body.underline:null,
                      Italic: req.body.italic?req.body.italic:null,
                      scheduled:true

                    },
                    { merge: true }
                  )
                  .then(function async(res) {
                    cron.schedule(
                      req.params.minute +
                        " " +
                        req.params.hour +
                        " " +
                        req.params.date +
                        " " +
                        req.params.month +
                        " *",
                      () => {
                  const po= tmp
                  .collection("posts").doc(res._path.segments[3])
                  const result = po.set({
                    scheduled:false
                  }, { merge: true });
                        
                      })
                    console.log(res._path.segments[3])
                    db.collection("users")
                      .doc(user.uid)
                      .collection("Followers")
                      .get()
                      .then((value) => {
                        value.forEach((doc) => {
                          db.collection("users")
                            .doc(doc.id)
                            .collection("NewsFeed")
                            .add({
                              image_url: image_url,
                              PostText: req.body.PostText,
                              Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                              fontName: req.body.fontname,
                              Bold: req.body.bold?req.body.bold:null,
                              Underline: req.body.underline?req.body.underline:null,
                              Italic: req.body.italic?req.body.italic:null,

                              
                            });
                        });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size; // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: 0,
                          });
                      });
  
                    db.collection("users")
                      .doc(user.uid)
                      .collection("posts")
                      .get()
                      .then((snap) => {
                        size = snap.size;
                        console.log(size); // will return the collection size
                        db.collection("users")
                          .doc(user.uid)
                          .collection("TotalPosts")
                          .doc(user.uid)
                          .set({
                            Total: size,
                          });
                      });
                  })
                  .then(function () {
                    res.status(200).send("Document successfully updated!");
                  })
                  .catch(function (error) {
                    // The document probably doesn't exist.
                    //res.status(400).send("error", error);
                    //res.status(404).send("Error updating document: ", error);
                  });
                }else{
                  res.send("Wrong fontname")
                }
                
                //res.json(image);
              }
            );
          } else if (
            (req.body.PostText && req.file === null) ||
            (req.body.PostText && !req.file)
          ) {
            console.log("no file", req.file);
            if(req.body.fontname == 'Nimla'|| req.body.fontname == 'Poppins' || req.body.fontname == 'Monster'){
              return tmp
              .collection("posts")
              .add(
                {
                  image_url: image_url,
                  PostText: req.body.PostText,
                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  fontName: req.body.fontname,
                  Bold: req.body.bold?req.body.bold:null,
                  Underline: req.body.underline?req.body.underline:null,
                  Italic: req.body.italic?req.body.italic:null,
                  scheduled:true

                },
                { merge: true }
              )
              .then(function (res) {
                cron.schedule(
                  req.params.minute +
                    " " +
                    req.params.hour +
                    " " +
                    req.params.date +
                    " " +
                    req.params.month +
                    " *",
                  () => {
              const po= tmp
              .collection("posts").doc(res._path.segments[3])
              const result = po.set({
                scheduled:false
              }, { merge: true });
                    
                  })
                console.log(res._path.segments[3])
                db.collection("users")
                  .doc(user.uid)
                  .collection("Followers")
                  .get()
                  .then((value) => {
                    value.forEach((doc) => {
                      db.collection("users")
                        .doc(doc.id)
                        .collection("NewsFeed")
                        .add({
                          image_url: image_url,
                          PostText: req.body.PostText,
                          Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          fontName: req.body.fontname,
                          Bold: req.body.bold?req.body.bold:null,
                          Underline: req.body.underline?req.body.underline:null,
                          Italic: req.body.italic?req.body.italic:null,

                          
                        });
                    });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size; // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: 0,
                      });
                  });

                db.collection("users")
                  .doc(user.uid)
                  .collection("posts")
                  .get()
                  .then((snap) => {
                    size = snap.size;
                    console.log(size); // will return the collection size
                    db.collection("users")
                      .doc(user.uid)
                      .collection("TotalPosts")
                      .doc(user.uid)
                      .set({
                        Total: size,
                      });
                  });
              })
              .then(function () {
                res.status(200).send("Document successfully updated!");
              })
              .catch(function (error) {
                // The document probably doesn't exist.
                //res.status(400).send("error", error);
                //res.status(404).send("Error updating document: ", error);
              });
              // if(req.body.bold && !req.body.underline && !req.body.italic){
            }else{
              res.send("Wrong fontname")
            }
          }
  
          if (
            (req.file && !req.body.PostText) ||
            (req.file && req.body.PostText === null)
          ) {
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
              { public_id: `PostsPics/${uniqueFilename}`, tags: `PostsPics` }, // directory and tags are optional
              function (err, image) {
                if (err) return res.send(err);
                console.log("file uploaded to Cloudinary");
  
                var fs = require("fs");
                fs.unlinkSync(path);
  
                image_url = image.secure_url;
                console.log(image_url);
                  return tmp
                      .collection("posts")
                      .add(
                        {
                          image_url: image_url,
                          PostText: null,
                          Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                          fontName: null,
                          Bold: null,
                          Underline: null,
                          Italic: null,
                          scheduled:true,
                        },
                        { merge: true }
                      )
                      .then(function (res) {
                        cron.schedule(
                          req.params.minute +
                            " " +
                            req.params.hour +
                            " " +
                            req.params.date +
                            " " +
                            req.params.month +
                            " *",
                          () => {
                      const po= tmp
                      .collection("posts").doc(res._path.segments[3])
                      const result = po.set({
                        scheduled:false
                      }, { merge: true });
                            
                          })
                        console.log(res._path.segments[3])
                        db.collection("users")
                          .doc(user.uid)
                          .collection("Followers")
                          .get()
                          .then((value) => {
                            value.forEach((doc) => {
                              db.collection("users")
                                .doc(doc.id)
                                .collection("NewsFeed")
                                .add({
                                  image_url: image_url,
                                  PostText: null,
                                  Timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                  fontName: null,
                                  Bold: null,
                                  Underline: null,
                                  Italic: null,
                                });
                            });
                          });
                        db.collection("users")
                          .doc(user.uid)
                          .collection("posts")
                          .get()
                          .then((snap) => {
                            size = snap.size; // will return the collection size
                            db.collection("users")
                              .doc(user.uid)
                              .collection("TotalPosts")
                              .doc(user.uid)
                              .set({
                                Total: 0,
                              });
                          });
      
                        db.collection("users")
                          .doc(user.uid)
                          .collection("posts")
                          .get()
                          .then((snap) => {
                            size = snap.size; // will return the collection size
                            db.collection("users")
                              .doc(user.uid)
                              .collection("TotalPosts")
                              .doc(user.uid)
                              .set({
                                Total: size,
                              });
                          });
                      })
                      .then(function () {
                        res.status(200).send("Document successfully updated!");
                      })
                      .catch(function (error) {
                        // The document probably doesn't exist.
                        res.status(400).send("error", error);
                        //res.status(404).send("Error updating document: ", error);
                      });
                
                //res.json(image);
              }
            );
          }
  
          // SEND FILE TO CLOUDINARY
        });
      } else {
        res.send("Not authorized");
      }
    }
  })
  .catch((error) => {
    res.send("Not authorized")
  });
    
    //  else {
    //   res.send("Not authorized dsdfdsfsd" );
    // }
  };
