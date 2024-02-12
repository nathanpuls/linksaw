// Initialize Firebase
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
  
 // Function to retrieve links for a specific user and display them on the page
function getLinksForUser(uid, username) {
    var linksRef = database.ref('links/' + uid);
    var linksList = document.getElementById('linksList');
    
    
    // Clear existing content in the list
    linksList.innerHTML = "";
  
    // Query the database for links with the specified username
    linksRef.orderByChild('username').equalTo(username).once('value')
      .then(function(snapshot) {
        // Check if any links were found
        if (snapshot.exists()) {
          // Links found, process and display them
          snapshot.forEach(function(linkSnapshot) {
            var linkData = linkSnapshot.val();
  
            
            var listItem = document.createElement('li');
            listItem.innerHTML = `
            
              <div class="row">
                <a href="${linkData.url}" target="_blank">
                  <div><strong>${linkData.name}</strong></div>
                </a>
              </div>`;
  
            // Append listItem to the linksList
            
            linksList.appendChild(listItem);
          });
  
         
        } else {
          console.log('No links found for the user.');
        }
      })
      .catch(function(error) {
        console.error('Error retrieving links:', error.message);
      });
  }
  
  // Get the value of the "user" parameter from the URL
  function getUserFromURL() {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const userParam = urlSearchParams.get('user');
    return userParam;
  }
  
  // Get the UID of the currently authenticated user (you need to implement this based on your authentication mechanism)
  const currentUserUID = "EG9r2xQNVbN4mU8swoVEI4KmDVs2";  // Replace with the actual UID
  
  // Example usage
  const usernameFromURL = getUserFromURL();
  
  if (usernameFromURL) {
    // Call the function to retrieve and display links for the user
    getLinksForUser(currentUserUID, usernameFromURL);
  } else {
    console.log('No "user" parameter found in the URL.');
  }
  

  //new

  // Reference to the links in the database
const linksRef = database.ref('links');

// Query the database to get links for the specific user
linksRef.orderByChild('username').equalTo(username).once('value').then((snapshot) => {
  const userLinks = snapshot.val();
console.log('new: ' + username);
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
