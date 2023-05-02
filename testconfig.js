// firebase admin setup
const config = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY,
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER,
  client_x509_cert_url: process.env.CLIENT_X509,
};
// let serviceAccount = require(config);
// const { isNumberObject } = require("util/types");
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });
console.log(process.env.PROJECT_ID);
admin.initializeApp({
  credential: admin.credential.cert(config),
});

// TYPE=service_account
// PROJECT_ID=ecom-website-ef3e5
// PRIVATE_KEY_ID=993f185ab00e65da7ba94d64edf92ed5b2cc8e19
// PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDK3JLDRCe9uW5V\nqcnwG77F8RZVT7Mjc5JpnS9tTXlfWSBbz6fKpevHBM8ARIMpTzAo9DNgXloFJy4h\nVFnqzcswHed+1i8BRGYRQ5D9AkWm+p28d8xpLjZuKbn3iCBIHlVKYqPO3B1q79NM\nmGloX7WBNX0sMYvo3EBfJS2X0ysXO2a/Pdm7+MO1n0hFZbeGFxiLC0dsDtvha5+Q\nNl55Lw8CoCfbOJQXowHwty/YVKGsgFzunw6u98iymi6KbmwUhni4Eb2/1S03yauc\noTxHlj/XPuIAhNfYXQs3dkt5HYFLShTNaHVCSy5Qs/DLcluBwYrLPP/kPLV3sPWp\nhlKnb6uTAgMBAAECggEAHwurU5eOSW/Oc0JdIDzuxkDuJ7eJynwjxRFZh8MajGgJ\nwWNB4jaK+ICY5AlC1W3uszskKF8S1xphlJeMfJhqvH4Rxox60cPTpwK4drAD/tj4\njjZQodbWXPz6c+fGS6MwxFsyMd89NUy8q/U19H4+kHv3dcL4uXYI9/FVophI+PCd\nb6jkT/+gGilua8AQNSpe+tIPrSlFD98KP6vjBywlIdS5/gd8T1cgolS/fJfmCB+1\nlC4Jkg2WOSKJVwLapyjFyPgqSWHgQNM1wZuMo1WuE1xD5iQ/XhocSy9LdydG3K5c\n7jD7pVBq6W86N7NxnzhEyzADUEvOLPaaCjmvKjsrUQKBgQDxuIKHU6bVXYuir7oR\nL9YKVU/F3xIdjqDmviSWVmfp5kO6hpVXdAQOE+d8+FosAHAM8SbeMz3+MIy/asWp\nf1hfjHPxye16+sySLlhb6p6G5ydYnMeAM8j+F57uyur+hW6oPlbfVlZDlsfrZUFr\nGqjvZ61Y6J3YD8VG1/Ot124ASwKBgQDW2GfBkYsYJlVU2MLv/oD/pczMgFh7AyUg\nOg93fHLj2rUrxgNGrLR0BEmiAvzisbpsHuYpsQiPeA2XlSsE4KCivF2n+55MN4GS\nkK8AVL2gj6cLaI0sbgvX939083w7qc8Hd/RUmPVpwX/F41qWIcZkl/nWZixB4Bpm\nlt/ATejE2QKBgCAS038RYnm9R+H2X0IYjtYgK82do9G4MzFq2X/5RyCKJUKCyR4p\njsAvc+/pJE3iYPvWo8moEvm/h21+xWuQMjG7eUcD/DbtQGfFLoRDxXUxBs+DPhWM\nyYatq7ETy8qp+dzpKK3Jzvh48V4SuXN0viXGJAJAG3Gn5g1YakUO6NGxAoGBAIM+\ncaui4GihSjFptTPsshr5yvEGWobS9gQI09f3MywUN+aEsQ2khRv2XpDU6G0Hi01v\nVsUTO5qBCTSXUE9LdXXUQhZTNHF02veQ4Qb/vVNvTek/NjZ1B1EoBTmJYFQGOM1k\nLuLbCdhP92EIsRbTjSF4YYvioJihcR9IfWk5br+JAoGAM420uoTqOs+Pzdj6ufmU\nArXgx11HcOI49qWpHRPthOOAG+eSNj/4Vhyo9Qd70WM76FQjiixdr4XkVka4uW0I\n5fDE2zQrB4AqfQmqECgK2Oy3E4bUFyz4PuNF+DqX1lmKIUWFSXG/BItYVRHN7IOG\nQkTz5Wuce3IpW2bDzGOwkSI=\n-----END PRIVATE KEY-----\n
// CLIENT_EMAIL=firebase-adminsdk-igrd4@ecom-website-ef3e5.iam.gserviceaccount.com
// CLIENT_ID=108310191022764476750
// AUTH_URI=https://accounts.google.com/o/oauth2/auth
// TOKEN_URI=https://oauth2.googleapis.com/token
// AUTH_PROVIDER=https://www.googleapis.com/oauth2/v1/certs
// CLIENT_X509=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-igrd4%40ecom-website-ef3e5.iam.gserviceaccount.com
