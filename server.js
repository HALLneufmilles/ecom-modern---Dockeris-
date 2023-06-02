// importing packages
const express = require("express");
const admin = require("firebase-admin");
const bcrypt = require("bcrypt");
const path = require("path");
const nodemailer = require("nodemailer");
const stripe = require("stripe"); // stripe payment 1
const dotenv = require("dotenv");

dotenv.config();
// firebase admin setup
// let serviceAccount = {
//   type: "service_account",
//   project_id: "ecom-website-ef3e5",
//   private_key_id: "993f185ab00e65da7ba94d64edf92ed5b2cc8e19",
//   private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDK3JLDRCe9uW5V\nqcnwG77F8RZVT7Mjc5JpnS9tTXlfWSBbz6fKpevHBM8ARIMpTzAo9DNgXloFJy4h\nVFnqzcswHed+1i8BRGYRQ5D9AkWm+p28d8xpLjZuKbn3iCBIHlVKYqPO3B1q79NM\nmGloX7WBNX0sMYvo3EBfJS2X0ysXO2a/Pdm7+MO1n0hFZbeGFxiLC0dsDtvha5+Q\nNl55Lw8CoCfbOJQXowHwty/YVKGsgFzunw6u98iymi6KbmwUhni4Eb2/1S03yauc\noTxHlj/XPuIAhNfYXQs3dkt5HYFLShTNaHVCSy5Qs/DLcluBwYrLPP/kPLV3sPWp\nhlKnb6uTAgMBAAECggEAHwurU5eOSW/Oc0JdIDzuxkDuJ7eJynwjxRFZh8MajGgJ\nwWNB4jaK+ICY5AlC1W3uszskKF8S1xphlJeMfJhqvH4Rxox60cPTpwK4drAD/tj4\njjZQodbWXPz6c+fGS6MwxFsyMd89NUy8q/U19H4+kHv3dcL4uXYI9/FVophI+PCd\nb6jkT/+gGilua8AQNSpe+tIPrSlFD98KP6vjBywlIdS5/gd8T1cgolS/fJfmCB+1\nlC4Jkg2WOSKJVwLapyjFyPgqSWHgQNM1wZuMo1WuE1xD5iQ/XhocSy9LdydG3K5c\n7jD7pVBq6W86N7NxnzhEyzADUEvOLPaaCjmvKjsrUQKBgQDxuIKHU6bVXYuir7oR\nL9YKVU/F3xIdjqDmviSWVmfp5kO6hpVXdAQOE+d8+FosAHAM8SbeMz3+MIy/asWp\nf1hfjHPxye16+sySLlhb6p6G5ydYnMeAM8j+F57uyur+hW6oPlbfVlZDlsfrZUFr\nGqjvZ61Y6J3YD8VG1/Ot124ASwKBgQDW2GfBkYsYJlVU2MLv/oD/pczMgFh7AyUg\nOg93fHLj2rUrxgNGrLR0BEmiAvzisbpsHuYpsQiPeA2XlSsE4KCivF2n+55MN4GS\nkK8AVL2gj6cLaI0sbgvX939083w7qc8Hd/RUmPVpwX/F41qWIcZkl/nWZixB4Bpm\nlt/ATejE2QKBgCAS038RYnm9R+H2X0IYjtYgK82do9G4MzFq2X/5RyCKJUKCyR4p\njsAvc+/pJE3iYPvWo8moEvm/h21+xWuQMjG7eUcD/DbtQGfFLoRDxXUxBs+DPhWM\nyYatq7ETy8qp+dzpKK3Jzvh48V4SuXN0viXGJAJAG3Gn5g1YakUO6NGxAoGBAIM+\ncaui4GihSjFptTPsshr5yvEGWobS9gQI09f3MywUN+aEsQ2khRv2XpDU6G0Hi01v\nVsUTO5qBCTSXUE9LdXXUQhZTNHF02veQ4Qb/vVNvTek/NjZ1B1EoBTmJYFQGOM1k\nLuLbCdhP92EIsRbTjSF4YYvioJihcR9IfWk5br+JAoGAM420uoTqOs+Pzdj6ufmU\nArXgx11HcOI49qWpHRPthOOAG+eSNj/4Vhyo9Qd70WM76FQjiixdr4XkVka4uW0I\n5fDE2zQrB4AqfQmqECgK2Oy3E4bUFyz4PuNF+DqX1lmKIUWFSXG/BItYVRHN7IOG\nQkTz5Wuce3IpW2bDzGOwkSI=\n-----END PRIVATE KEY-----\n",
//   client_email: "firebase-adminsdk-igrd4@ecom-website-ef3e5.iam.gserviceaccount.com",
//   client_id: "108310191022764476750",
//   auth_uri: "https://accounts.google.com/o/oauth2/auth",
//   token_uri: "https://oauth2.googleapis.com/token",
//   auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
//   client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-igrd4%40ecom-website-ef3e5.iam.gserviceaccount.com",
// };

const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.replace(/\\n/gm, "\n") : undefined,
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER,
  client_x509_cert_url: process.env.CLIENT_X509,
};
//const { isNumberObject } = require("util/types");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

let db = admin.firestore();
console.log(process.env.PROJECT_ID);
// aws config
const aws = require("aws-sdk");

const { log } = require("console");

// aws parameters
const region = "eu-west-3";
const bucketName = "monpremiersite";
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

aws.config.update({
  region,
  accessKeyId,
  secretAccessKey,
});

// init s3
const s3 = new aws.S3();

// generate image upload link
async function generateUrl() {
  let date = new Date();
  let id = parseInt(Math.random() * 10000000000);

  const imageName = `${id}${date.getTime()}.jpg`;

  const params = {
    Bucket: bucketName,
    Key: imageName,
    Expires: 300, //300 ms
    ContentType: "image/jpeg",
  };
  const uploadUrl = await s3.getSignedUrlPromise("putObject", params);
  return uploadUrl;
}

// declare static path
let staticPath = path.join(__dirname, "public");

//intializing express.js
const app = express();

//middlewares
app.use(express.static(staticPath));
app.use(express.json());

//routes
//home route
app.get("/", (req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});

//signup route
app.get("/signup", (req, res) => {
  res.sendFile(path.join(staticPath, "signup.html"));
});

app.post("/signup", (req, res) => {
  let { name, email, password, number, tac, notification } = req.body;

  // form validations
  if (name.length < 3) {
    return res.json({ alert: "name must be 3 letters long" });
  } else if (!email.length) {
    return res.json({ alert: "enter your email" });
  } else if (password.length < 8) {
    return res.json({ alert: "password should be 8 letters long" });
  } else if (!number.length) {
    return res.json({ alert: "enter your phone number" });
  } else if (!Number(number) || number.length < 10) {
    return res.json({ alert: "invalid number, please enter valid one" });
  } else if (!tac) {
    return res.json({ alert: "you must agree to our terms and conditions" });
  }

  // store user in db
  db.collection("users")
    .doc(email)
    .get()
    .then((user) => {
      if (user.exists) {
        return res.json({ alert: "email already exists" });
      } else {
        // encrypt the password before storing it.
        bcrypt.genSalt(10, (err, salt) => {
          bcrypt.hash(password, salt, (err, hash) => {
            req.body.password = hash;
            db.collection("users")
              .doc(email)
              .set(req.body)
              .then((data) => {
                res.json({
                  name: req.body.name,
                  email: req.body.email,
                  seller: req.body.seller,
                  cart: [],
                  wishlist: [],
                });
              });
          });
        });
      }
    });
});

// login route
app.get("/login", (req, res) => {
  res.sendFile(path.join(staticPath, "login.html"));
});

// app.post("/login", (req, res) => {
//   let { email, password } = req.body;

//   if (!email.length || !password.length) {
//     return res.json({ alert: "fill all the inputs" });
//   }

//   db.collection("users")
//     .doc(email)
//     .get()
//     .then((user) => {
//       if (!user.exists) {
//         // if email does not exists
//         return res.json({ alert: "log in email does not exists" });
//       } else {
//         bcrypt.compare(password, user.data().password, (err, result) => {
//           if (result) {
//             let data = user.data();
//             return res.json({
//               name: data.name,
//               email: data.email,
//               seller: data.seller,
//             });
//           } else {
//             return res.json({ alert: "password is incorrect" });
//           }
//         });
//       }
//     });
// });

// app.post("/login", (req, res) => {
//   let { email, password } = req.body;

//   if (!email.length || !password.length) {
//     return res.json({ alert: "fill all the inputs" });
//   }

//   const sellerPromise = db.collection("sellers").doc(email).get();

//   const userPromise = db.collection("users").doc(email).get();

//   const savedPromise = db.collection("saved").doc(email).get();

//   Promise.all([userPromise, savedPromise, sellerPromise]).then(([user, saved, seller]) => {
//     if (!user.exists) {
//       // if email does not exists
//       return res.json({ alert: "log in email does not exists" });
//     } else {
//       bcrypt.compare(password, user.data().password, (err, result) => {
//         if (result) {
//           let data = user.data();
//           let response = {
//             name: data.name,
//             email: data.email,
//             seller: data.seller,
//           };
//           if (seller.exists) {
//             const sellerData = seller.data();
//             response.tagsSeller = sellerData.tagsSeller;
//           }
//           if (saved.exists) {
//             const savedData = saved.data();
//             // console.log("saveData: ", savedData);
//             const { cart, wishlist } = savedData;
//             // console.log("cart: ", cart);
//             // console.log("cawishlistrt: ", wishlist);
//             response.cart = cart;
//             response.wishlist = wishlist;
//           } else {
//             response.cart = [];
//             response.wishlist = [];
//           }
//           // console.log("response: ", response);
//           return res.json(response);
//         } else {
//           return res.json({ alert: "password is incorrect" });
//         }
//       });
//     }
//   });
// });

app.post("/login", (req, res) => {
  let { email, password } = req.body;

  if (!email.length || !password.length) {
    return res.json({ alert: "fill all the inputs" });
  }
  const sellerPromise = db.collection("sellers").doc(email).get();
  const userPromise = db.collection("users").doc(email).get();
  const savedPromise = db.collection("saved").doc(email).get();

  Promise.all([userPromise, savedPromise, sellerPromise]).then(([user, saved, seller]) => {
    if (!user.exists) {
      return res.json({ alert: "log in email does not exist" });
    }

    bcrypt.compare(password, user.data().password, (err, result) => {
      if (result) {
        const data = user.data();
        const response = {
          name: data.name,
          email: data.email,
          seller: data.seller,
          tagsSeller: seller.data().tagsSeller ? seller.data().tagsSeller : null,
          cart: saved.exists ? saved.data().cart : [],
          wishlist: saved.exists ? saved.data().wishlist : [],
        };
        return res.json(response);
      } else {
        return res.json({ alert: "password is incorrect" });
      }
    });
  });
});

// seller route
app.get("/seller", (req, res) => {
  res.sendFile(path.join(staticPath, "seller.html"));
});

app.post("/seller", (req, res) => {
  let { name, about, address, number, tac, legit, email } = req.body;
  if (!name.length || !address.length || !about.length || number.length < 10 || !Number(number)) {
    return res.json({ alert: "some inforamation(s) is/are invalid" });
  } else if (!tac || !legit) {
    return res.json({ alert: "you must agree to our terms and conditions" });
  } else {
    // update users seller status here.
    db.collection("sellers")
      .doc(email)
      .set(req.body)
      .then((data) => {
        db.collection("users")
          .doc(email)
          .update({
            seller: true,
          })
          .then((data) => {
            res.json(true);
          });
      });
  }
});

// add product
app.get("/add-product", (req, res) => {
  res.sendFile(path.join(staticPath, "addProduct.html"));
});

app.get("/add-product/:id", (req, res) => {
  res.sendFile(path.join(staticPath, "addProduct.html"));
});

// get the upload link
app.get("/s3url", (req, res) => {
  generateUrl().then((url) => res.json(url));
});

// add product
app.post("/add-product", (req, res) => {
  let { name, shortDes, des, images, sizes, actualPrice, discount, sellPrice, stock, tags, tac, email, draft, id } = req.body;

  // validation
  if (!draft) {
    if (!name.length) {
      return res.json({ alert: "enter product name" });
    } else if (shortDes.length > 100 || shortDes.length < 10) {
      return res.json({ alert: "short description must be between 10 to 100 letters long" });
    } else if (!des.length) {
      return res.json({ alert: "enter detail description about the product" });
    } else if (!images.length) {
      // image link array
      return res.json({ alert: "upload atleast one product image" });
    } else if (!sizes.length) {
      // size array
      return res.json({ alert: "select at least one size" });
    } else if (!actualPrice.length || !discount.length || !sellPrice.length) {
      return res.json({ alert: "you must add pricings" });
    } else if (stock < 20) {
      return res.json({ alert: "you should have at least 20 items in stock" });
    } else if (!tags.length) {
      return res.json({ alert: "enter few tags to help ranking your product in search" });
    } else if (!tac) {
      return res.json({ alert: "you must agree to our terms and conditions" });
    }
  }

  // add product
  let docName = id == undefined ? `${name.toLowerCase()}-${Math.floor(Math.random() * 5000)}` : id;
  db.collection("products")
    .doc(docName)
    .set(req.body)
    .then((data) => {
      res.json({ product: name });
    })
    .catch((err) => {
      return res.json({ alert: "some error occured. Try again" });
    });
});

// get products
app.post("/get-products", (req, res) => {
  let { email, id, tag } = req.body;

  if (id) {
    docRef = db.collection("products").doc(id);
    // Si tag alors
  } else if (tag) {
    docRef = db.collection("products").where("tags", "array-contains", tag);
  } else {
    docRef = db.collection("products").where("email", "==", email);
  }

  docRef.get().then((products) => {
    if (products.empty) {
      return res.json("no products");
    }
    let productArr = [];
    if (id) {
      return res.json(products.data());
    } else {
      products.forEach((item) => {
        let data = item.data();
        data.id = item.id;
        productArr.push(data);
      });
      res.json(productArr);
    }
  });
});

app.post("/delete-product", (req, res) => {
  let { id } = req.body;
  //console.log(req.body);
  docRef = db.collection("products").doc(id);
  // console.log(`docRef : `, docRef);
  docRef.get().then((product) => {
    let imageUrls = product.data().images;
    // console.log(`product.data() --- : `, imageUrls);
    imageLinks = imageUrls.filter((value) => value);
    // console.log(`imageLinks : `, imageLinks);
    idImages = imageLinks.map((url) => url.split("/").pop());
    console.log(idImages);

    const promises = idImages.map((idImage) => {
      const bucketParams = {
        Bucket: bucketName,
        Key: idImage,
        // Expires: 300, //300 ms
        // ContentType: "image/jpeg",
      };

      return s3.deleteObject(bucketParams).promise();
    });

    Promise.all(promises)
      .then(() => {
        db.collection("products")
          .doc(id)
          .delete()
          .then((data) => {
            res.json("success");
          })
          .catch((err) => {
            res.json("err");
          });
      })
      .catch((err) => {
        console.log("Error", err);
      });
  });
});

// app.post("/delete-product", (req, res) => {
//   let { id } = req.body;
//   console.log(req.body);
//   docRef = db.collection("products").doc(id);
//   // console.log(`docRef : `, docRef);
//   docRef.get().then((product) => {
//     let imageUrls = product.data().images;
//     // console.log(`product.data() --- : `, imageUrls);
//     imageLinks = imageUrls.filter((value) => value);
//     // console.log(`imageLinks : `, imageLinks);
//     idImages = imageLinks.map((url) => url.split("/").pop());
//     console.log(idImages);
//     idImages.forEach((idImage) => {
//       const bucketParams = {
//         Bucket: bucketName,
//         Key: idImage,
//         // Expires: 300, //300 ms
//         // ContentType: "image/jpeg",
//       };

//       const run = async () => {
//         try {
//           const data = await s3.deleteObject(bucketParams).promise();
//           console.log("Success!", data);
//           return data; // For unit tests.
//         } catch (err) {
//           console.log("Error", err);
//         }
//       };
//       run();
//     });
//     db.collection("products")
//       .doc(id)
//       .delete()
//       .then((data) => {
//         res.json("success");
//       })
//       .catch((err) => {
//         res.json("err");
//       });
//   });
// });

// product page
app.get("/products/:id", (req, res) => {
  res.sendFile(path.join(staticPath, "product.html"));
});

app.get("/search/:key", (req, res) => {
  res.sendFile(path.join(staticPath, "search.html"));
});

app.get("/cart", (req, res) => {
  res.sendFile(path.join(staticPath, "cart.html"));
});

// app.post("/savecart", (req, res) => {
//   let { email, cart, wishlist, tagsSeller } = req.body;
//   let docName = email;
//   let cartSaved = { cart, wishlist };
//   db.collection("saved")
//     .doc(docName)
//     .set(cartSaved)
//     .then((data) => {
//       res.json("saved");
//     })
//     .catch((err) => {
//       return res.json("some error occured in save. Try again");
//     });
// });
app.post("/savecart", (req, res) => {
  const { email, cart, wishlist, tagsSeller } = req.body;
  const docName = email;
  const cartSaved = { cart, wishlist };

  const promises = [];

  // Mise à jour de la collection "saved"
  promises.push(db.collection("saved").doc(docName).set(cartSaved));

  // Mise à jour de la collection "sellers"
  if (tagsSeller) {
    promises.push(db.collection("sellers").doc(docName).set({ tagsSeller }, { merge: true }));
  }

  // Exécution de toutes les promises
  Promise.all(promises)
    .then(() => {
      res.json("saved");
    })
    .catch((err) => {
      console.error(err);
      res.json("some error occurred in save. Try again");
    });
});

app.post("/getcartsaved", (req, res) => {
  let { email } = req.body;
  let docName = email;
  db.collection("saved")
    .doc(docName)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        return res.json(data);
      } else {
        return res.json("no products saved");
      }
    });
});

// app.post("/tagsSeller", (req, res) => {
//   let { email, tagsSeller } = req.body;
//   // update tagsSeller here.

//   db.collection("seller")
//     .doc(email)
//     .update({
//       tagsSeller: tagsSeller,
//     })
//     .then((data) => {
//       res.json(console.log("updated"));
//     });
// });

app.get("/checkout", (req, res) => {
  res.sendFile(path.join(staticPath, "checkout.html"));
});

//stripe payment 2
// On prépare notre key utilisateur stripe
let stripeGateway = stripe(process.env.stripe_key);

// On prépare l'adresse de notre domaine qu'il faut communiquer à sprite pour qu'il nous retourne sa réponse.
let DOMAIN = process.env.DOMAIN;

// On prépare une requete sever pour qu'il demande une url de paiement à stripe. Pour ça, il faut communiquer à stripe ce dont il à besoin
app.post("/stripe-checkout", async (req, res) => {
  // console.log(`req.body : `, req.body);
  // ouverture d'une session stripe
  const session = await stripeGateway.checkout.sessions.create({
    // strip à besoin de parametres :
    payment_method_types: ["card"], // la méthode de payment ( je croix que la carte est paramétrer par défaut donc peut-etre pas nécéssaire)
    // le mode
    mode: "payment",
    // stripe payment 3
    // On demande à stripe de rediriger l'utilisateur vers l'adresse (end-point) ${DOMAIN}/success donc http://localhost:5000/success
    // en lui passant en parametre, cad après le signe "?" 'session_id' et 'order' pour que lorsque le navigateur ateindra ce end-point,
    // une fetch sera executer pour enregistrer l'achat dans la base de données 'firebase'.
    // comme le end-point '/success' n'existe pas encore, on va le créer ... voir stripe payment 4.
    success_url: `${DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}&order=${JSON.stringify(req.body)}`,
    // même chose en cas d'annulation de la commande par l'utilisateur ( sur la page stripe il y à une flache "retour" vers la gauche pour annuler le paiement)
    cancel_url: `${DOMAIN}/checkout?payment_fail=true`,
    // enfin on communique le items à payer sous forme d'un tableau d'objets correspondant à chaque items à partir de req.body.items qui donne accès à "cart",
    // qui est lui même un tableau d'objet.(ex: cart: [{"item":"2","name":"Porte-manteau gros plan jpeg"…st-3.amazonaws.com/89416347401679846304030.jpg"}] )
    // les items sont transmis par la fetch POST "/stripe-checkout" de checkout.js

    line_items: req.body.items.map((item) => {
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
            description: item.shortDes,
            images: [item.image],
          },
          unit_amount: item.sellPrice * 100,
        },
        quantity: item.item,
      };
    }),
  });
  // en réponse on demande au server de nous retourner l'url que lui à envoyée 'stripe'.
  res.json(session.url);
});

// stripe payment 4
app.get("/success", async (req, res) => {
  // on recupère les parametres (?) 'order' et 'session_id' de l'url avec 'req.query' ... voir stripe payment 3
  let { order, session_id } = req.query;

  try {
    // Avec 'session_id' on récupère les données de la session stripe.
    const session = await stripeGateway.checkout.sessions.retrieve(session_id);
    // console.log(`session`, session);
    // on récupère l'email de la session qui va nous servir joindre les données à l'utilisateur dans firebase.
    const customer = session.customer_details.email;
    // on crée une date qui va nous servir à identifier l'ordre d'achat (l'identification du document) dans firebase.
    let date = new Date();
    // création du nom du doc pour firebase, puis on enregistre les données.
    let docName = `${customer.email}-order-${date.getTime()}`;
    db.collection("order")
      .doc(docName)
      .set(JSON.parse(order))
      .then((data) => {
        res.redirect("/checkout?payment=done");
        // si tout s'est bien passé il faut en informer l'utilisateur en lui affichant une alerte success sur la page ... voir stripe payment 5 dans checkout.js
      });
  } catch (err) {
    res.json("error, see your terminal");
    // console.log(err);
    res.redirect("/404");
  }
});

// app.post("/order", (req, res) => {
//   const { order, email, add } = req.body;

//   let transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL,
//       pass: process.env.PASSWORD,
//     },
//   });

//   const mailOption = {
//     from: "testsixmilles@gmail.com",
//     to: email,
//     subject: "Clothing : Order Placed",
//     html: `
//         <!DOCTYPE html>
//         <html lang="en">
//         <head>
//             <meta charset="UTF-8">
//             <meta http-equiv="X-UA-Compatible" content="IE=edge">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <title>Document</title>

//             <style>
//                 body{
//                     min-height: 90vh;
//                     background: #f5f5f5;
//                     font-family: sans-serif;
//                     display: flex;
//                     justify-content: center;
//                     align-items: center;
//                 }
//                 .heading{
//                     text-align: center;
//                     font-size: 40px;
//                     width: 50%;
//                     display: block;
//                     line-height: 50px;
//                     margin: 30px auto 60px;
//                     text-transform: capitalize;
//                 }
//                 .heading span{
//                     font-weight: 300;
//                 }
//                 .btn{
//                     width: 200px;
//                     height: 50px;
//                     border-radius: 5px;
//                     background: #3f3f3f;
//                     color: #fff;
//                     display: block;
//                     margin: auto;
//                     font-size: 18px;
//                     text-transform: capitalize;
//                 }
//             </style>

//         </head>
//         <body>

//             <div>
//                 <h1 class="heading">dear ${email.split("@")[0]}, <span>your order is successfully placed</span></h1>
//                 <button class="btn">check status</button>
//             </div>

//         </body>
//         </html>
//         `,
//   };

//   let docName = email + Math.floor(Math.random() * 123719287419824);
//   db.collection("order")
//     .doc(docName)
//     .set(req.body)
//     .then((data) => {
//       transporter.sendMail(mailOption, (err, info) => {
//         if (err) {
//           res.json({ alert: "opps! its seems like some err occured. Try again" });
//         } else {
//           res.json({ alert: "your order is placed", type: "success" });
//         }
//       });
//     });
// });

// 404 route
app.get("/404", (req, res) => {
  res.sendFile(path.join(staticPath, "404.html"));
});

app.use((req, res) => {
  res.redirect("/404");
});

app.listen(5000, () => {
  console.log("listening on port 5000.......");
});
