 // Replace with your Firebase project config
 var firebaseConfig = {
    apiKey: "AIzaSyCauN-vsgUfQJXc5b41NoCnYzi6FIn86MQ",
    authDomain: "linkshare-eb70b.firebaseapp.com",
    databaseURL: "https://linkshare-eb70b-default-rtdb.firebaseio.com",
    projectId: "linkshare-eb70b",
    storageBucket: "linkshare-eb70b.appspot.com",
    messagingSenderId: "284502085616",
    appId: "1:284502085616:web:3f24e3fb844320eef85735",
    measurementId: "G-VQ0J98LXYT"
  };

  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  var database = firebase.database();

    // Function to extract username from email
    function getUsernameFromEmail(email) {
        return email.split('@')[0];
      }
      
    // Function to copy link to clipboard
    function copyLink(username, linkName) {
        var fullLink = `https://linksaw.com/${username}/${linkName}`;
        navigator.clipboard.writeText(fullLink)
          .then(function() {
            alert('Link copied to clipboard!');
          })
          .catch(function(error) {
            console.error('Error copying link to clipboard:', error);
          });
      }

  // Add an authentication state observer
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      // User is signed in
      loadLinks(user.uid);
    } else {
      // No user signed in
      document.getElementById('linksList').innerHTML = 'Please sign in to view your links.';
    }
  });

  function loadLinks(userId) {
    var linksList = document.getElementById('linksList');

    // Clear the existing list
    linksList.innerHTML = '';

       // Load links from the database
       var linksRef = database.ref('links/' + userId);
       linksRef.once('value')
         .then(function(snapshot) {
           snapshot.forEach(function(childSnapshot) {
             var linkKey = childSnapshot.key;
             var linkData = childSnapshot.val();
     
             getUsernameFromEmail();
             // Create list item for each link
             var listItem = document.createElement('li');
             listItem.innerHTML = `<strong>${linkData.name}:</strong> 
               <a href="${username}/${linkData.url}" target="_blank">${linkData.url}</a>
               <button onclick="editLink('${userId}', '${linkKey}', '${linkData.url}', '${linkData.name}')">Edit</button>
               <button onclick="deleteLink('${userId}', '${linkKey}')">Delete</button>
               <button onclick="copyLink('${username}', '${linkData.name}')">Copy</button>`;
               console.log('username');
             linksList.appendChild(listItem);
           });
         })
         .catch(function(error) {
           console.error('Error loading links:', error);
         });
     }

  function addLink() {
    var url = document.getElementById('url').value;
    var name = document.getElementById('name').value;

    // Check if URL and Name are not empty
    if (!url.trim() || !name.trim()) {
      alert('Please enter a valid URL and Name.');
      return;
    }

    // Get the current user
    var currentUser = firebase.auth().currentUser;

    // Check if the user is signed in
    if (currentUser) {
      // Save the link to the database
      var linkRef = database.ref('links/' + currentUser.uid).push();
      linkRef.set({
        url: url,
        name: name
      })
      .then(function() {
        //alert('Link added successfully!');
        // Clear the input fields after adding the link
        document.getElementById('url').value = '';
        document.getElementById('name').value = '';
        // Reload the links
        loadLinks(currentUser.uid);
      })
      .catch(function(error) {
        alert('Error adding link: ' + error.message);
      });
    } else {
      alert('No user signed in.');
    }
  }

  function editLink(userId, linkKey, currentUrl, currentName) {
    var newUrl = prompt('Enter the new URL:', currentUrl);
    var newName = prompt('Enter the new Name:', currentName);

    // Check if the user entered a new URL and Name
    if (newUrl !== null && newName !== null) {
      // Update the link in the database
      database.ref('links/' + userId + '/' + linkKey).update({
        url: newUrl,
        name: newName
      })
      .then(function() {
        //alert('Link updated successfully!');
        // Reload the links
        loadLinks(userId);
      })
      .catch(function(error) {
        alert('Error updating link: ' + error.message);
      });
    }
  }

  function deleteLink(userId, linkKey) {
    // Confirm if the user wants to delete the link
    if (confirm('Are you sure you want to delete this link?')) {
      // Delete the link from the database
      database.ref('links/' + userId + '/' + linkKey).remove()
        .then(function() {
          //alert('Link deleted successfully!');
          // Reload the links
          loadLinks(userId);
        })
        .catch(function(error) {
          alert('Error deleting link: ' + error.message);
        });
    }
  }
  function getUsernameFromEmail(email) {
// Assuming the email is of the form username@gmail.com
return email.split('@')[0];
}

firebase.auth().onAuthStateChanged(function(user) {
if (user) {
  // User is signed in
  console.log('User is signed in:', user);

  // Extract the username from the email
  var username = getUsernameFromEmail(user.email);

  console.log('Username:', username);

  // Display the username
  var usernameElement = document.getElementById('username');
  usernameElement.innerText = username;
  return username;
} else {
  // No user signed in
  console.log('No user signed in.');

  // Clear the username display when no user is signed in
  var usernameElement = document.getElementById('username');
  usernameElement.innerText = '';
}
});

function getUsernameFromEmail(email) {
// Implement the logic to extract the username from the email
// For example, remove the "@gmail.com" part
return email.split('@')[0];
}


