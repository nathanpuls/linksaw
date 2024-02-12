var firebaseConfig = {
    apiKey: "AIzaSyCauN-vsgUfQJXc5b41NoCnYzi6FIn86MQ",
    authDomain: "linkshare-eb70b.firebaseapp.com",
    databaseURL: "https://linkshare-eb70b-default-rtdb.firebaseio.com",
    projectId: "linkshare-eb70b",
    storageBucket: "linkshare-eb70b.appspot.com",
    messagingSenderId: "284502085616",
    appId: "1:284502085616:web:3f24e3fb844320eef85735",
    measurementId: "G-VQ0J98LXYT",
  };
  

  firebase.initializeApp(firebaseConfig);
  var database = firebase.database();


  
  // Function to get URL parameter by name
  function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  // Get the username parameter from the URL
  const usernameFromURL = getParameterByName('user');

  if (usernameFromURL) {
    // Call the function to retrieve and display links for the user
    getLinksForUser(usernameFromURL);
  } else {
    console.log('No "user" parameter found in the URL.');
  }

  // Function to get and display links for a user
  function getLinksForUser(username) {
    // Reference to the Firebase Realtime Database
    const database = firebase.database();

    // Reference to the links in the database
    const linksRef = database.ref('links');

    // Query the database to get links for the specific user
    linksRef.orderByChild('username').equalTo(username).once('value').then((snapshot) => {
      const userLinks = snapshot.val();

      // Display links on the page
      const userLinksDiv = document.getElementById('userLinks');
      if (userLinks) {
        userLinksDiv.innerHTML = '<h2>Links for ' + username + '</h2>';
        Object.keys(userLinks).forEach((linkKey) => {
          const link = userLinks[linkKey];
          userLinksDiv.innerHTML += '<p>Name: ' + link.name + '<br>URL: ' + link.url + '</p>';
        });
      } else {
        userLinksDiv.innerHTML = 'No links found for ' + username;
      }
    }).catch((error) => {
      console.error('Error fetching user links:', error);
    });
  }