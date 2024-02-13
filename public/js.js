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

try {
  firebase.initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Assuming you have a reference to the database
var database = firebase.database();

// Reference to the "users" node in your database
var usersRef = database.ref('users');
const linksRef = database.ref('links');
const linksContainer = document.getElementById('linksContainer');

function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}



var publicUrlParam = getUrlParameter('user');
atuser = `@${publicUrlParam}`;

document.title = atuser



// var brand = document.getElementById('public-brand');
// brand.innerText = 'Linksaw';

// Username to search for
var targetUsername = getUrlParameter('user');

// Find the user with the specified username
usersRef.orderByChild('username').equalTo(targetUsername).once('value')
  .then(function(snapshot) {
    // Check if the user with the specified username exists
    if (snapshot.exists()) {
      // Get the UID of the user
      var userUID = Object.keys(snapshot.val())[0];
      console.log('UID of user with username', targetUsername, ':', userUID);

      // Retrieve and display links for the user
      linksRef.child(userUID).once('value')
        .then(userSnapshot => {
          console.log('User Snapshot:', userSnapshot.val()); // Add this line for debugging

          const userLinks = userSnapshot.val(); // Directly get the links object under the user UID

          console.log('User UID:', userUID); // Add this line for debugging
          console.log('User Links:', userLinks); // Add this line for debugging

          // Check if the user has links
          if (userLinks && typeof userLinks === 'object') {
            // Iterate over each link under the user
            Object.keys(userLinks).forEach(linkKey => {
              const link = userLinks[linkKey];
              // Assuming 'username' is a field within each link
              const linkUsername = link.username;

              if (linkUsername && linkUsername === targetUsername) {
                // Create an HTML link element for the link
                const linkElement = document.createElement('a');
                linkElement.textContent = link.name; // Assuming 'name' is a field within the link
                linkElement.target = "_blank";
                var url = link.url;
                if (
                  !url.startsWith("http://") &&
                  !url.startsWith("https://") &&
                  !url.startsWith("www")
                ) {
                  // If not, add http:// to the beginning
                  url = "http://" + url;
                }
                linkElement.href = url; // Set the href attribute
                document.getElementById("publicUser").innerText = atuser;
                // Create a new paragraph element for each link
                const paragraphElement = document.createElement('p');
                // Append the link element to the paragraph
                paragraphElement.appendChild(linkElement);

                // Append the paragraph to the container
                linksContainer.appendChild(paragraphElement);

                // Log for debugging
                console.log(`User UID: ${userUID}, Link Key: ${linkKey}, Username: ${linkUsername}, Link Name: ${link.name}`);
              }
            });
          }
        })
        .catch(error => {
          console.error("Error reading data:", error);
        });

    } else {
      console.log('User with username', targetUsername, 'not found');
    }
  })
  .catch(function(error) {
    console.error('Error finding user:', error);
  });
